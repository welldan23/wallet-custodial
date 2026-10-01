import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { formatUnits } from 'viem';

import type { Catalog } from '../catalog/repository.js';
import { TimeoutError, withTimeout } from '../lib/timeout.js';
import { decodeEvmTransfer } from '../transactions/decode-evm.js';
import {
  decodeSolanaTransfer,
  type TokenAccountOwnerResolver,
} from '../transactions/decode-solana.js';
import type { SwapProgressChecker } from '../swap/progress.js';
import { StatusRefresher } from '../transactions/refresh.js';
import type { TransactionStatusChecker } from '../transactions/status.js';
import type { TransactionStore } from '../transactions/store.js';
import {
  BroadcastRejectedError,
  TransactionDecodeError,
  type DecodedTransfer,
  type TransactionBroadcaster,
} from '../transactions/types.js';
import type { Network, SwapTransaction, Transaction } from '../types.js';

export type TransactionsRouteDeps = {
  loadCatalog: () => Catalog;
  broadcasters: Map<string, TransactionBroadcaster>;
  transactionStore: TransactionStore;
  /** HMAC alamat → `wallet_key`. */
  walletKey: (address: string) => string;
  rpcTimeoutMs: number;
  /** Solana: cari pemilik akun token penerima (untuk riwayat). */
  resolveTokenAccountOwner?: TokenAccountOwnerResolver;
  /** Pengecek status di blockchain per jaringan (untuk GET /:id). */
  statusCheckers?: Map<string, TransactionStatusChecker>;
  /** Pemantau hasil swap (jumlah diterima, status bridge). */
  swapProgress?: SwapProgressChecker;
  /** Dipakai bersama route swap; dibuat sendiri kalau tidak diberikan. */
  statusRefresher?: StatusRefresher;
  now?: () => Date;
};

export { SOLANA_EXPIRY_MS, STUCK_AFTER_MS } from '../transactions/refresh.js';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Bentuk transaksi untuk aplikasi (tanpa `walletKey`); swap ikut membawa detailnya. */
export function publicTransaction(tx: Transaction | SwapTransaction, catalog: Catalog) {
  const token = catalog.tokens.find((item) => item.id === tx.tokenId);
  const network = catalog.networks.find((item) => item.id === tx.networkId);
  const swap = 'swap' in tx ? tx.swap : null;
  const toToken = swap && catalog.tokens.find((item) => item.id === swap.toTokenId);
  const toNetwork = swap && catalog.networks.find((item) => item.id === swap.toNetworkId);
  const toAmount = (raw: string | null) =>
    raw !== null && toToken ? formatUnits(BigInt(raw), toToken.decimals) : null;
  return {
    id: tx.id,
    type: tx.type,
    status: tx.status,
    networkId: tx.networkId,
    tokenId: tx.tokenId,
    symbol: token?.symbol ?? null,
    amountRaw: tx.amountRaw,
    amount: token ? formatUnits(BigInt(tx.amountRaw), token.decimals) : null,
    amountUsd: tx.amountUsd,
    feeRaw: tx.feeRaw,
    counterpartyAddress: tx.counterpartyAddress,
    txHash: tx.txHash,
    explorerUrl: network ? `${network.explorerUrl.replace(/\/$/, '')}/tx/${tx.txHash}` : null,
    source: tx.source,
    blockTime: tx.blockTime,
    createdAt: tx.createdAt,
    updatedAt: tx.updatedAt,
    swap: swap
      ? {
          provider: swap.provider,
          toNetworkId: swap.toNetworkId,
          toTokenId: swap.toTokenId,
          toSymbol: toToken?.symbol ?? null,
          quotedAmount: toAmount(swap.quotedAmountRaw),
          minAmount: toAmount(swap.minAmountRaw),
          receivedAmount: toAmount(swap.receivedAmountRaw),
          slippageBps: swap.slippageBps,
          bridgeStatus: swap.bridgeStatus,
          destinationTxHash: swap.destinationTxHash,
          destinationExplorerUrl:
            swap.destinationTxHash && toNetwork
              ? `${toNetwork.explorerUrl.replace(/\/$/, '')}/tx/${swap.destinationTxHash}`
              : null,
        }
      : null,
  };
}

const MESSAGES: Record<string, string> = {
  invalid_encoding: 'signedTransaction is not a valid signed transaction for this network.',
  unsigned: 'The transaction is not signed by the sender.',
  wrong_chain: 'The transaction was signed for a different chain.',
  unsupported_transaction: 'Only a single transfer of a supported token can be sent.',
  unsupported_token: 'This token is not supported.',
  invalid_amount: 'The amount must be greater than zero.',
  insufficient_funds: 'Not enough balance to cover the amount and network fee.',
  nonce_too_low: 'This transaction was already replaced or sent.',
  fee_too_low: 'The network fee is too low right now. Please try again.',
  blockhash_expired: 'The transaction expired before it was sent. Please sign again.',
  rejected: 'The network rejected this transaction.',
};

/**
 * POST /v1/transactions — teruskan transaksi yang SUDAH ditandatangani di HP
 * ke jaringan, lalu catat di riwayat (status `pending`).
 *
 * Body: `{ "network": "arbitrum", "signedTransaction": "0x…" | "<base64 Solana>" }`.
 * Isi riwayat (pengirim, penerima, token, jumlah) dibaca dari transaksi itu
 * sendiri, bukan dari klaim aplikasi. Backend tidak pernah memegang kunci.
 */
export function transactionsRoutes(deps: TransactionsRouteDeps): Hono {
  const app = new Hono();
  const refresher = deps.statusRefresher ?? new StatusRefresher(deps);
  const resolveOwner: TokenAccountOwnerResolver =
    deps.resolveTokenAccountOwner ?? (async () => null);

  app.post(
    '/',
    bodyLimit({
      maxSize: 64 * 1024,
      onError: (c) =>
        c.json({ error: 'body_too_large', message: 'Request body is too large.' }, 413),
    }),
    async (c) => {
      const body = (await c.req.json().catch(() => null)) as {
        network?: unknown;
        signedTransaction?: unknown;
      } | null;
      const networkId = typeof body?.network === 'string' ? body.network : '';
      const signed =
        typeof body?.signedTransaction === 'string' ? body.signedTransaction.trim() : '';

      const catalog = deps.loadCatalog();
      const network = catalog.networks.find((item) => item.id === networkId && item.isActive);
      if (!network) {
        return c.json({ error: 'unknown_network', message: 'network is not supported.' }, 400);
      }
      if (!signed) {
        return c.json(
          { error: 'missing_transaction', message: 'signedTransaction is required.' },
          400,
        );
      }
      const broadcaster = deps.broadcasters.get(network.id);
      if (!broadcaster) {
        return c.json({ error: 'broadcast_unavailable', message: 'No RPC for this network.' }, 503);
      }

      let decoded: DecodedTransfer;
      try {
        decoded = await decode(network, signed, catalog, resolveOwner, deps.rpcTimeoutMs);
      } catch (error) {
        if (error instanceof TransactionDecodeError) {
          return c.json({ error: error.code, message: MESSAGES[error.code] }, 400);
        }
        throw error;
      }
      const token = catalog.tokens.find((item) => item.id === decoded.tokenId);
      if (!token?.isVisible) {
        return c.json({ error: 'unsupported_token', message: MESSAGES.unsupported_token }, 400);
      }

      const walletKey = deps.walletKey(decoded.from);
      const existing = deps.transactionStore.findByHash(walletKey, network.id, decoded.txHash);
      if (existing) return c.json({ transaction: publicTransaction(existing, catalog) }, 200);

      try {
        await withTimeout(broadcaster.send(signed), deps.rpcTimeoutMs);
      } catch (error) {
        if (error instanceof BroadcastRejectedError) {
          return c.json({ error: error.code, message: MESSAGES[error.code] }, 422);
        }
        console.warn(
          `[broadcast] ${network.id} gagal: ${error instanceof Error ? error.name : 'unknown'}`,
        );
        const code = error instanceof TimeoutError ? 'rpc_timeout' : 'rpc_error';
        // Belum tentu gagal masuk jaringan: aplikasi boleh kirim ulang transaksi yang sama.
        return c.json(
          { error: code, message: 'Could not reach the network. Try sending again.' },
          502,
        );
      }

      const price = catalog.pricesBySymbol.get(token.symbol);
      const amountUsd = price
        ? Math.round(
            Number(formatUnits(decoded.amountRaw, token.decimals)) * price.usdPrice * 1e6,
          ) / 1e6
        : null;
      const { transaction, created } = deps.transactionStore.insertPending({
        walletKey,
        networkId: network.id,
        tokenId: token.id,
        type: 'send',
        amountRaw: decoded.amountRaw,
        amountUsd,
        counterpartyAddress: decoded.counterparty,
        txHash: decoded.txHash,
      });
      return c.json({ transaction: publicTransaction(transaction, catalog) }, created ? 201 : 200);
    },
  );

  /**
   * GET /v1/transactions/:id — status kiriman. Kalau masih `pending`, cek ke
   * blockchain (paling sering tiap 5 detik) lalu simpan hasilnya beserta
   * biaya yang benar-benar terpakai. Id = UUID dari POST (tidak bisa ditebak).
   */
  app.get('/:id', async (c) => {
    c.header('Cache-Control', 'no-store');
    const id = c.req.param('id');
    const transaction = UUID_PATTERN.test(id) ? deps.transactionStore.findById(id) : null;
    if (!transaction) {
      return c.json({ error: 'not_found', message: 'Transaction not found.' }, 404);
    }
    return c.json(statusBody(await refresher.refresh(transaction), deps));
  });

  return app;
}

/** Bentuk jawaban status (dipakai juga route swap). */
export function statusBody(
  result: { transaction: Transaction; isStuck: boolean; checkFailed: boolean },
  deps: Pick<TransactionsRouteDeps, 'loadCatalog' | 'transactionStore'>,
) {
  const { transaction } = result;
  const full =
    transaction.type === 'swap'
      ? (deps.transactionStore.findSwap(transaction.id) ?? transaction)
      : transaction;
  return {
    transaction: publicTransaction(full, deps.loadCatalog()),
    isFinal: transaction.status !== 'pending',
    isStuck: result.isStuck,
    checkFailed: result.checkFailed,
  };
}

export const isTransactionId = (value: string) => UUID_PATTERN.test(value);

function decode(
  network: Network,
  signed: string,
  catalog: Catalog,
  resolveOwner: TokenAccountOwnerResolver,
  timeoutMs: number,
): Promise<DecodedTransfer> {
  if (network.chainType === 'solana') {
    // Lookup pemilik akun token boleh gagal: riwayat tetap mencatat akun tokennya.
    const safeResolve: TokenAccountOwnerResolver = (account) =>
      withTimeout(resolveOwner(account), timeoutMs).catch(() => null);
    return decodeSolanaTransfer(signed, catalog.tokens, safeResolve);
  }
  return decodeEvmTransfer(signed, network, catalog.tokens);
}
