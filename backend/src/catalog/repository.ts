import type { Db } from '../db/database.js';
import type { ChainType, Network, Price, Token } from '../types.js';

export type Catalog = {
  networks: Network[];
  tokens: Token[];
  pricesBySymbol: Map<string, Price>;
};

type NetworkRow = {
  id: string;
  name: string;
  chainId: string;
  chainType: ChainType;
  nativeSymbol: string;
  explorerUrl: string;
  isActive: number;
};

type TokenRow = Omit<Token, 'isStablecoin' | 'isVisible'> & {
  isStablecoin: number;
  isVisible: number;
};

/** Baca jaringan, token, dan harga dari SQLite (urutan jaringan sesuai urutan seed). */
export function loadCatalog(db: Db): Catalog {
  const networks = (
    db
      .prepare(
        `SELECT id, name, chain_id AS chainId, chain_type AS chainType,
                native_symbol AS nativeSymbol, explorer_url AS explorerUrl, is_active AS isActive
         FROM networks ORDER BY rowid`,
      )
      .all() as NetworkRow[]
  ).map((row) => ({ ...row, isActive: row.isActive === 1 }));

  const tokens = (
    db
      .prepare(
        `SELECT id, symbol, name, network_id AS networkId, contract_address AS contractAddress,
                decimals, is_stablecoin AS isStablecoin, is_visible AS isVisible
         FROM tokens ORDER BY rowid`,
      )
      .all() as TokenRow[]
  ).map((row) => ({
    ...row,
    isStablecoin: row.isStablecoin === 1,
    isVisible: row.isVisible === 1,
  }));

  const prices = db
    .prepare(
      `SELECT symbol, usd_price AS usdPrice, idr_rate AS idrRate, updated_at AS updatedAt
       FROM prices`,
    )
    .all() as Price[];

  return {
    networks,
    tokens,
    pricesBySymbol: new Map(prices.map((price) => [price.symbol, price])),
  };
}
