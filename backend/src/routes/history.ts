import { isAddress as isSolanaAddress } from '@solana/kit';
import { Hono } from 'hono';
import { formatUnits, getAddress, isAddress as isEvmAddress } from 'viem';

import type { Catalog } from '../catalog/repository.js';
import type { ContactStore } from '../contacts/store.js';
import { isMonth, monthRange } from '../lib/month.js';
import type { StatusRefresher } from '../transactions/refresh.js';
import type { TransactionStore } from '../transactions/store.js';
import type { TransactionType } from '../types.js';

import { deviceTokenFrom } from './contacts.js';
import { isTransactionId, publicTransaction, statusBody } from './transactions.js';

export type HistoryRouteDeps = {
  loadCatalog: () => Catalog;
  transactionStore: TransactionStore;
  walletKey: (address: string) => string;
  /** Untuk detail: perbarui status transaksi yang masih pending. */
  refresher?: StatusRefresher;
  /** Untuk detail: nama kontak lawan transaksi (butuh token perangkat). */
  contactStore?: ContactStore;
};

const sameAddress = (a: string, b: string) =>
  a.startsWith('0x') ? a.toLowerCase() === b.toLowerCase() : a === b;

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;
const TYPES: TransactionType[] = ['send', 'receive', 'swap'];

/**
 * GET /v1/history?evm=0x…&solana=…[&month=2026-09&tzOffset=420&type=send&limit=20&before=…]
 *
 * Daftar transaksi (kirim, terima, swap) milik alamat-alamat ini, terbaru
 * dulu. `month` dihitung di zona waktu pengguna (`tzOffset` menit dari UTC,
 * WIB = 420). Halaman pertama juga membawa ringkasan seluruh filter dan
 * daftar bulan yang punya transaksi (untuk chip filter).
 */
export function historyRoutes(deps: HistoryRouteDeps): Hono {
  const app = new Hono();

  app.get('/', (c) => {
    c.header('Cache-Control', 'no-store');
    const q = (name: string) => c.req.query(name)?.trim() || '';
    const evm = q('evm');
    const solana = q('solana');
    const fail = (error: string, message: string) => c.json({ error, message }, 400);

    if (!evm && !solana) return fail('missing_address', 'Provide evm and/or solana.');
    if (evm && !isEvmAddress(evm, { strict: false })) {
      return fail('invalid_evm_address', 'evm is not a valid address.');
    }
    if (solana && !isSolanaAddress(solana)) {
      return fail('invalid_solana_address', 'solana is not a valid address.');
    }

    const month = q('month') || null;
    if (month && !isMonth(month)) return fail('invalid_month', 'month must be YYYY-MM.');
    const tzOffset = q('tzOffset') ? Number(q('tzOffset')) : 0;
    if (!Number.isInteger(tzOffset) || tzOffset < -720 || tzOffset > 840) {
      return fail('invalid_tz_offset', 'tzOffset must be minutes between -720 and 840.');
    }
    const type = (q('type') || undefined) as TransactionType | undefined;
    if (type && !TYPES.includes(type))
      return fail('invalid_type', 'type must be send, receive, or swap.');
    const limitInput = q('limit') ? Number(q('limit')) : DEFAULT_LIMIT;
    if (!Number.isInteger(limitInput) || limitInput < 1)
      return fail('invalid_limit', 'limit must be a positive integer.');
    const limit = Math.min(limitInput, MAX_LIMIT);
    const before = q('before') || undefined;
    if (before && !/^[^|]+\|[0-9a-f-]{36}$/i.test(before)) {
      return fail('invalid_cursor', 'before is not a valid cursor.');
    }

    const keys = [evm && deps.walletKey(getAddress(evm)), solana && deps.walletKey(solana)].filter(
      (key): key is string => Boolean(key),
    );
    const filter = { range: month ? monthRange(month, tzOffset) : undefined, type };
    const items = deps.transactionStore.listHistory(keys, { ...filter, limit, before });
    const catalog = deps.loadCatalog();
    const last = items.at(-1);

    return c.json({
      transactions: items.map((item) => publicTransaction(item, catalog)),
      nextBefore: items.length === limit && last ? `${last.createdAt}|${last.id}` : null,
      // Ringkasan & daftar bulan cukup di halaman pertama.
      ...(before
        ? {}
        : {
            summary: { month, ...deps.transactionStore.summarizeHistory(keys, filter) },
            months: deps.transactionStore.historyMonths(keys, tzOffset),
          }),
    });
  });

  /**
   * GET /v1/history/:id — detail satu transaksi: data lengkap (+ detail swap),
   * jaringan & token, biaya dalam koin gas dan USD, status terbaru, dan nama
   * kontak lawan transaksi kalau ada header `Authorization: Device <token>`.
   */
  app.get('/:id', async (c) => {
    c.header('Cache-Control', 'no-store');
    const id = c.req.param('id');
    const stored = isTransactionId(id) ? deps.transactionStore.findById(id) : null;
    if (!stored) return c.json({ error: 'not_found', message: 'Transaction not found.' }, 404);

    const result = deps.refresher
      ? await deps.refresher.refresh(stored)
      : { transaction: stored, isStuck: false, checkFailed: false };
    const body = statusBody(result, deps);
    const tx = result.transaction;
    const catalog = deps.loadCatalog();
    const network = catalog.networks.find((item) => item.id === tx.networkId);
    const token = catalog.tokens.find((item) => item.id === tx.tokenId);
    const native = catalog.tokens.find(
      (item) => item.networkId === tx.networkId && item.contractAddress === null,
    );
    const nativePrice = network && catalog.pricesBySymbol.get(network.nativeSymbol);

    let fee = null;
    if (tx.feeRaw !== null && native) {
      const amount = formatUnits(BigInt(tx.feeRaw), native.decimals);
      fee = {
        amount,
        symbol: native.symbol,
        usd: nativePrice ? Math.round(Number(amount) * nativePrice.usdPrice * 1e6) / 1e6 : null,
      };
    }

    let counterpartyContact: string | null = null;
    const deviceToken = deviceTokenFrom(c.req.header('Authorization'));
    if (deviceToken && deps.contactStore) {
      const userId = deps.contactStore.findUserId(deviceToken);
      const match = userId
        ? deps.contactStore
            .list(userId)
            .find(
              (contact) =>
                sameAddress(contact.address, tx.counterpartyAddress) &&
                (contact.networkId === null || contact.networkId === tx.networkId),
            )
        : undefined;
      counterpartyContact = match?.name ?? null;
    }

    return c.json({
      ...body,
      network: network
        ? {
            id: network.id,
            name: network.name,
            chainType: network.chainType,
            nativeSymbol: network.nativeSymbol,
            explorerUrl: network.explorerUrl,
          }
        : null,
      token: token
        ? { tokenId: token.id, symbol: token.symbol, name: token.name, decimals: token.decimals }
        : null,
      fee,
      counterpartyContact,
    });
  });

  return app;
}
