import { isAddress as isSolanaAddress } from '@solana/kit';
import { Hono } from 'hono';
import { getAddress, isAddress as isEvmAddress } from 'viem';

import type { Catalog } from '../catalog/repository.js';
import { checkAddress } from '../transactions/lookalike.js';
import type { TransactionStore } from '../transactions/store.js';
import type { ChainType } from '../types.js';

export type AddressCheckRouteDeps = {
  loadCatalog: () => Catalog;
  transactionStore: TransactionStore;
  walletKey: (address: string) => string;
};

const isValid = (value: string, chainType: ChainType) =>
  chainType === 'solana' ? isSolanaAddress(value) : isEvmAddress(value, { strict: false });
const normalize = (value: string, chainType: ChainType) =>
  chainType === 'solana' ? value : getAddress(value);

/**
 * GET /v1/address-check?network=arbitrum&owner=0x…&to=0x…
 *
 * Cek alamat tujuan terhadap alamat yang pernah dikirimi `owner`:
 * `known` (persis sama), `lookalike` (awal & akhir sama tapi beda — pola
 * address poisoning), atau `new`. Untuk EVM, riwayat semua jaringan EVM
 * ikut dicek karena alamatnya sama di semua chain.
 */
export function addressCheckRoutes(deps: AddressCheckRouteDeps): Hono {
  const app = new Hono();

  app.get('/', (c) => {
    // Jawaban memuat riwayat pribadi: jangan disimpan cache mana pun.
    c.header('Cache-Control', 'no-store');
    const networkId = c.req.query('network')?.trim() ?? '';
    const owner = c.req.query('owner')?.trim() ?? '';
    const to = c.req.query('to')?.trim() ?? '';

    const { networks } = deps.loadCatalog();
    const network = networks.find((item) => item.id === networkId && item.isActive);
    if (!network) {
      return c.json({ error: 'unknown_network', message: 'network is not supported.' }, 400);
    }
    if (!isValid(owner, network.chainType)) {
      return c.json({ error: 'invalid_owner', message: 'owner is not a valid address.' }, 400);
    }
    if (!isValid(to, network.chainType)) {
      return c.json({ error: 'invalid_to', message: 'to is not a valid address.' }, 400);
    }

    const sameType = networks
      .filter((item) => item.chainType === network.chainType)
      .map((item) => item.id);
    const history = deps.transactionStore.listSentCounterparties(
      deps.walletKey(normalize(owner, network.chainType)),
      sameType,
    );
    const check = checkAddress(normalize(to, network.chainType), history);

    return c.json({
      result: check.result,
      match:
        check.result === 'new'
          ? null
          : {
              address: check.match.address,
              timesUsed: check.match.timesUsed,
              lastUsedAt: check.match.lastUsedAt,
              networkIds: check.match.networkIds,
              ...(check.result === 'lookalike'
                ? { samePrefix: check.prefix, sameSuffix: check.suffix }
                : {}),
            },
      checkedAddresses: history.length,
    });
  });

  return app;
}
