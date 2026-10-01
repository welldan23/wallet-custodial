import { Hono } from 'hono';

import type { Catalog } from '../catalog/repository.js';
import { hasStalePrice, latestPrice } from '../prices/latest.js';

export type PricesRouteDeps = {
  loadCatalog: () => Catalog;
  /** Harga lebih tua dari ini ditandai `isStale`. */
  priceStaleAfterMs: number;
  now?: () => Date;
};

/** GET /v1/prices — harga token yang tampil di aplikasi + kurs USD→IDR. */
export function pricesRoutes(deps: PricesRouteDeps): Hono {
  const app = new Hono();

  app.get('/', (c) => {
    const { tokens, pricesBySymbol } = deps.loadCatalog();
    const symbols = [
      ...new Set(tokens.filter((token) => token.isVisible).map((token) => token.symbol)),
    ];
    const prices = symbols.flatMap((symbol) => {
      const price = pricesBySymbol.get(symbol);
      return price ? [price] : [];
    });
    const latest = latestPrice(prices);

    // Harga sama untuk semua pengguna → boleh di-cache sebentar oleh CDN.
    c.header('Cache-Control', 'public, max-age=30');
    return c.json({
      base: 'USD',
      fx: { USD: 1, IDR: latest?.idrRate ?? null },
      prices: prices.map((price) => ({
        symbol: price.symbol,
        usdPrice: price.usdPrice,
        idrPrice: Math.round(price.usdPrice * price.idrRate * 100) / 100,
        updatedAt: price.updatedAt,
      })),
      updatedAt: latest?.updatedAt ?? null,
      isStale: hasStalePrice(prices, deps.now?.() ?? new Date(), deps.priceStaleAfterMs),
    });
  });

  return app;
}
