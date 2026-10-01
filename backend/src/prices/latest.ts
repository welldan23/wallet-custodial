import type { Price } from '../types.js';

/** Harga yang paling baru diperbarui (dipakai sebagai sumber kurs terkini). */
export function latestPrice(prices: Iterable<Price>): Price | null {
  let latest: Price | null = null;
  for (const price of prices) {
    if (!latest || price.updatedAt > latest.updatedAt) latest = price;
  }
  return latest;
}

/** `true` kalau ada harga yang lebih tua dari `staleAfterMs` (atau belum ada harga). */
export function hasStalePrice(prices: Price[], now: Date, staleAfterMs: number): boolean {
  if (prices.length === 0) return true;
  return prices.some((price) => now.getTime() - Date.parse(price.updatedAt) > staleAfterMs);
}
