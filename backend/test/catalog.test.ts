import { isAddress as isSolanaAddress } from '@solana/kit';
import { isAddress as isEvmAddress } from 'viem';
import { describe, expect, it } from 'vitest';

import { MVP_NETWORKS, MVP_TOKENS } from '../src/catalog/mvp.js';
import { loadCatalog } from '../src/catalog/repository.js';
import { runMigrations } from '../src/db/database.js';
import { seedCatalog } from '../src/db/seed.js';

import { seededDb } from './helpers.js';

describe('katalog MVP', () => {
  it('alamat kontrak EVM lolos checksum, mint Solana formatnya valid', () => {
    for (const token of MVP_TOKENS) {
      if (!token.contractAddress) continue;
      const network = MVP_NETWORKS.find((item) => item.id === token.networkId);
      const valid =
        network?.chainType === 'solana'
          ? isSolanaAddress(token.contractAddress)
          : isEvmAddress(token.contractAddress, { strict: true });
      expect(valid, token.id).toBe(true);
    }
  });

  it('tiap jaringan punya tepat satu koin gas sesuai simbolnya', () => {
    for (const network of MVP_NETWORKS) {
      const gasCoins = MVP_TOKENS.filter(
        (token) => token.networkId === network.id && token.contractAddress === null,
      );
      expect(
        gasCoins.map((token) => token.symbol),
        network.id,
      ).toEqual([network.nativeSymbol]);
    }
  });

  it('id token unik dan semuanya menunjuk ke jaringan yang ada', () => {
    const ids = MVP_TOKENS.map((token) => token.id);
    expect(new Set(ids).size).toBe(ids.length);
    const networkIds = new Set(MVP_NETWORKS.map((network) => network.id));
    for (const token of MVP_TOKENS) expect(networkIds.has(token.networkId), token.id).toBe(true);
  });
});

describe('seed & migrasi', () => {
  it('aman dijalankan berulang tanpa duplikat', () => {
    const db = seededDb();
    runMigrations(db);
    seedCatalog(db);
    const catalog = loadCatalog(db);
    expect(catalog.networks).toHaveLength(MVP_NETWORKS.length);
    expect(catalog.tokens).toHaveLength(MVP_TOKENS.length);
    expect(catalog.networks.map((network) => network.id)).toEqual(
      MVP_NETWORKS.map((network) => network.id),
    );
  });

  it('tidak menimpa pengaturan tampil/aktif dan harga yang sudah diperbarui', () => {
    const db = seededDb();
    db.prepare("UPDATE tokens SET is_visible = 1 WHERE id = 'dai-ethereum'").run();
    db.prepare("UPDATE networks SET is_active = 0 WHERE id = 'base'").run();
    db.prepare(
      "UPDATE prices SET usd_price = 3100, updated_at = '2026-10-02T00:00:00.000Z' WHERE symbol = 'ETH'",
    ).run();

    seedCatalog(db);
    const catalog = loadCatalog(db);

    expect(catalog.tokens.find((token) => token.id === 'dai-ethereum')?.isVisible).toBe(true);
    expect(catalog.networks.find((network) => network.id === 'base')?.isActive).toBe(false);
    expect(catalog.pricesBySymbol.get('ETH')?.usdPrice).toBe(3100);
  });
});
