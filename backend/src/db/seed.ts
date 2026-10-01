import { MVP_NETWORKS, MVP_TOKENS, SEED_PRICES } from '../catalog/mvp.js';
import type { Network, Token } from '../types.js';

import type { Db } from './database.js';

/**
 * Isi katalog jaringan & token MVP (aman dijalankan berulang). Status
 * `is_active`/`is_visible` yang sudah diubah di database tidak ditimpa.
 */
export function seedCatalog(
  db: Db,
  {
    networks = MVP_NETWORKS,
    tokens = MVP_TOKENS,
    now = new Date(),
  }: { networks?: Network[]; tokens?: Token[]; now?: Date } = {},
): void {
  const upsertNetwork = db.prepare(`
    INSERT INTO networks (id, name, chain_id, chain_type, native_symbol, explorer_url, is_active)
    VALUES (@id, @name, @chainId, @chainType, @nativeSymbol, @explorerUrl, @isActive)
    ON CONFLICT (id) DO UPDATE SET
      name = excluded.name,
      chain_id = excluded.chain_id,
      chain_type = excluded.chain_type,
      native_symbol = excluded.native_symbol,
      explorer_url = excluded.explorer_url
  `);
  const upsertToken = db.prepare(`
    INSERT INTO tokens (id, symbol, name, network_id, contract_address, decimals, is_stablecoin, is_visible)
    VALUES (@id, @symbol, @name, @networkId, @contractAddress, @decimals, @isStablecoin, @isVisible)
    ON CONFLICT (id) DO UPDATE SET
      symbol = excluded.symbol,
      name = excluded.name,
      network_id = excluded.network_id,
      contract_address = excluded.contract_address,
      decimals = excluded.decimals,
      is_stablecoin = excluded.is_stablecoin
  `);
  const insertPrice = db.prepare(`
    INSERT INTO prices (id, symbol, usd_price, idr_rate, updated_at)
    VALUES (@id, @symbol, @usdPrice, @idrRate, @updatedAt)
    ON CONFLICT (symbol) DO NOTHING
  `);

  db.transaction(() => {
    for (const network of networks) {
      upsertNetwork.run({ ...network, isActive: network.isActive ? 1 : 0 });
    }
    for (const token of tokens) {
      upsertToken.run({
        ...token,
        isStablecoin: token.isStablecoin ? 1 : 0,
        isVisible: token.isVisible ? 1 : 0,
      });
    }
    for (const price of SEED_PRICES) {
      insertPrice.run({
        ...price,
        id: price.symbol.toLowerCase(),
        updatedAt: now.toISOString(),
      });
    }
  })();
}
