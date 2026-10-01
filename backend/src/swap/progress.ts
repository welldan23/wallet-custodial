import { createSolanaRpc, signature } from '@solana/kit';

import type { BridgeStatus, Network, SwapTransaction, Token } from '../types.js';

/** Hasil lanjutan swap setelah transaksi asal masuk blok. */
export type SwapProgress = {
  state: 'pending' | 'success' | 'failed';
  bridgeStatus?: BridgeStatus;
  receivedAmountRaw?: bigint;
  destinationTxHash?: string;
};

export interface SwapProgressChecker {
  check(
    swap: SwapTransaction,
    context: { fromNetwork: Network; toNetwork: Network; toToken: Token },
  ): Promise<SwapProgress>;
}

type LifiStatus = {
  status?: string;
  substatus?: string;
  receiving?: { txHash?: string; amount?: string; token?: { address?: string } };
};

const lifiChain = (network: Network) => (network.chainType === 'solana' ? 'SOL' : network.chainId);
const sameAddress = (a?: string, b?: string | null) =>
  Boolean(a && b) && (a!.startsWith('0x') ? a!.toLowerCase() === b!.toLowerCase() : a === b);

/**
 * Status LI.FI (`GET /v1/status`), untuk swap satu jaringan maupun bridge:
 * DONE+COMPLETED/PARTIAL → selesai, DONE+REFUNDED / FAILED → gagal (koin
 * dikembalikan / tidak terkirim), lainnya → masih jalan.
 */
export function lifiProgressChecker(options: {
  baseUrl?: string;
  apiKey?: string;
  timeoutMs: number;
  fetch?: typeof fetch;
}): (
  swap: SwapTransaction,
  ctx: { fromNetwork: Network; toNetwork: Network; toToken: Token },
) => Promise<SwapProgress> {
  const doFetch = options.fetch ?? fetch;
  return async (swap, { fromNetwork, toNetwork, toToken }) => {
    const params = new URLSearchParams({
      txHash: swap.txHash,
      fromChain: lifiChain(fromNetwork),
      toChain: lifiChain(toNetwork),
    });
    const response = await doFetch(`${options.baseUrl ?? 'https://li.quest'}/v1/status?${params}`, {
      headers: options.apiKey ? { 'x-lifi-api-key': options.apiKey } : {},
      signal: AbortSignal.timeout(options.timeoutMs),
    });
    // 404 = LI.FI belum melihat transaksinya: anggap masih jalan.
    if (response.status === 404) return { state: 'pending' };
    if (!response.ok) throw new Error(`lifi_status_${response.status}`);
    const body = (await response.json()) as LifiStatus;

    if (body.status === 'FAILED') return { state: 'failed', bridgeStatus: 'failed' };
    if (body.status !== 'DONE') return { state: 'pending', bridgeStatus: 'pending' };
    if (body.substatus === 'REFUNDED') {
      return {
        state: 'failed',
        bridgeStatus: 'refunded',
        destinationTxHash: body.receiving?.txHash,
      };
    }
    // PARTIAL = diterima dalam token lain: jumlahnya tidak dicatat sebagai token tujuan.
    const matches = sameAddress(body.receiving?.token?.address, toToken.contractAddress);
    return {
      state: 'success',
      bridgeStatus: 'done',
      destinationTxHash: body.receiving?.txHash,
      receivedAmountRaw:
        matches && body.receiving?.amount ? BigInt(body.receiving.amount) : undefined,
    };
  };
}

type ParsedTokenBalance = {
  mint: string;
  owner?: string;
  uiTokenAmount: { amount: string };
};

/** Selisih saldo token `mint` milik pembayar biaya di satu transaksi Solana. */
export function receivedFromBalances(
  payer: string,
  mint: string,
  pre: ParsedTokenBalance[],
  post: ParsedTokenBalance[],
): bigint | undefined {
  const total = (list: ParsedTokenBalance[]) =>
    list
      .filter((entry) => entry.mint === mint && entry.owner === payer)
      .reduce((sum, entry) => sum + BigInt(entry.uiTokenAmount.amount), 0n);
  if (!post.some((entry) => entry.mint === mint && entry.owner === payer)) return undefined;
  const diff = total(post) - total(pre);
  return diff > 0n ? diff : undefined;
}

/** Jupiter: jumlah diterima dibaca dari saldo token sebelum/sesudah di transaksi itu. */
export function jupiterProgressChecker(rpcUrl: string) {
  const rpc = createSolanaRpc(rpcUrl);
  return async (swap: SwapTransaction, { toToken }: { toToken: Token }): Promise<SwapProgress> => {
    const tx = await rpc
      .getTransaction(signature(swap.txHash), {
        encoding: 'jsonParsed',
        commitment: 'confirmed',
        maxSupportedTransactionVersion: 0,
      })
      .send();
    if (!tx?.meta) return { state: 'pending' };
    if (tx.meta.err) return { state: 'failed' };
    const payer = String(tx.transaction.message.accountKeys[0]?.pubkey ?? '');
    const received = receivedFromBalances(
      payer,
      toToken.contractAddress ?? '',
      (tx.meta.preTokenBalances ?? []) as unknown as ParsedTokenBalance[],
      (tx.meta.postTokenBalances ?? []) as unknown as ParsedTokenBalance[],
    );
    return { state: 'success', receivedAmountRaw: received };
  };
}

/** Gabungkan: LI.FI untuk swap/bridge LI.FI, Jupiter untuk swap Jupiter. */
export function createSwapProgressChecker(options: {
  lifi: ReturnType<typeof lifiProgressChecker>;
  jupiter?: ReturnType<typeof jupiterProgressChecker>;
}): SwapProgressChecker {
  return {
    async check(swap, context) {
      if (swap.swap.provider === 'jupiter') {
        return options.jupiter ? options.jupiter(swap, context) : { state: 'success' };
      }
      return options.lifi(swap, context);
    },
  };
}
