import type { Db } from '../db/database.js';

import type { FxSource, UsdPriceSource } from './sources.js';

export type PriceRefreshResult = {
  /** Simbol yang harganya berhasil diperbarui. */
  updated: string[];
  /** Simbol yang gagal didapat — harga lamanya tetap dipakai. */
  missing: string[];
  idrRate: number | null;
  /** Sumber kurs di putaran ini; `null` = memakai kurs yang sudah ada. */
  fxSource: string | null;
};

export type PriceServiceOptions = {
  db: Db;
  /** Dicoba berurutan; sumber berikutnya hanya untuk simbol yang belum dapat. */
  priceSources: UsdPriceSource[];
  /** Dicoba berurutan sampai ada yang berhasil. */
  fxSources: FxSource[];
  /** Kurs cukup diambil sesekali (sumbernya update harian). */
  fxRefreshIntervalMs: number;
  now?: () => Date;
  log?: (message: string) => void;
};

const errorName = (error: unknown) => (error instanceof Error ? error.name : 'unknown');

/**
 * Memperbarui tabel `prices` (harga USD + kurs USD→IDR) dari API publik.
 * Kalau semua sumber gagal, harga lama tidak diubah — API akan menandainya
 * kedaluwarsa (`isStale`) alih-alih menampilkan angka nol.
 */
export class PriceService {
  private fx: { rate: number; fetchedAt: number } | null = null;
  private inFlight: Promise<PriceRefreshResult> | null = null;

  constructor(private readonly options: PriceServiceOptions) {}

  /** Satu putaran refresh. Panggilan bersamaan berbagi putaran yang sama. */
  refresh(): Promise<PriceRefreshResult> {
    this.inFlight ??= this.runRefresh().finally(() => {
      this.inFlight = null;
    });
    return this.inFlight;
  }

  /** Refresh sekarang lalu berkala. Mengembalikan fungsi untuk berhenti. */
  start(intervalMs: number): () => void {
    const tick = () => {
      this.refresh().catch((error) => this.log(`[harga] refresh gagal: ${errorName(error)}`));
    };
    tick();
    const timer = setInterval(tick, intervalMs);
    timer.unref();
    return () => clearInterval(timer);
  }

  private async runRefresh(): Promise<PriceRefreshResult> {
    const { db, priceSources } = this.options;
    const now = this.options.now?.() ?? new Date();
    const symbols = (
      db.prepare('SELECT DISTINCT symbol FROM tokens ORDER BY symbol').all() as { symbol: string }[]
    ).map((row) => row.symbol);

    const fxSource = await this.refreshFx(now);
    const idrRate = this.fx?.rate ?? this.storedIdrRate();

    const prices = new Map<string, number>();
    for (const source of priceSources) {
      const pending = symbols.filter((symbol) => !prices.has(symbol));
      if (pending.length === 0) break;
      try {
        for (const [symbol, usdPrice] of await source.fetchUsdPrices(pending)) {
          if (pending.includes(symbol)) prices.set(symbol, usdPrice);
        }
      } catch (error) {
        this.log(`[harga] ${source.name} gagal: ${errorName(error)}`);
      }
    }

    // Tanpa kurs sama sekali, baris harga tidak bisa disimpan (idr_rate wajib).
    const updated = idrRate === null ? [] : [...prices.keys()];
    if (updated.length > 0) {
      const upsert = db.prepare(`
        INSERT INTO prices (id, symbol, usd_price, idr_rate, updated_at)
        VALUES (@id, @symbol, @usdPrice, @idrRate, @updatedAt)
        ON CONFLICT (symbol) DO UPDATE SET
          usd_price = excluded.usd_price,
          idr_rate = excluded.idr_rate,
          updated_at = excluded.updated_at
      `);
      db.transaction(() => {
        for (const symbol of updated) {
          upsert.run({
            id: symbol.toLowerCase(),
            symbol,
            usdPrice: prices.get(symbol),
            idrRate,
            updatedAt: now.toISOString(),
          });
        }
      })();
    }

    const missing = symbols.filter((symbol) => !updated.includes(symbol));
    if (missing.length > 0) this.log(`[harga] tidak diperbarui: ${missing.join(', ')}`);
    return { updated, missing, idrRate, fxSource };
  }

  private async refreshFx(now: Date): Promise<string | null> {
    const due = !this.fx || now.getTime() - this.fx.fetchedAt >= this.options.fxRefreshIntervalMs;
    if (!due) return null;

    for (const source of this.options.fxSources) {
      try {
        const rate = await source.fetchUsdToIdr();
        this.fx = { rate, fetchedAt: now.getTime() };
        return source.name;
      } catch (error) {
        this.log(`[kurs] ${source.name} gagal: ${errorName(error)}`);
      }
    }
    return null;
  }

  private storedIdrRate(): number | null {
    const row = this.options.db
      .prepare('SELECT idr_rate AS idrRate FROM prices ORDER BY updated_at DESC LIMIT 1')
      .get() as { idrRate: number } | undefined;
    return row?.idrRate ?? null;
  }

  private log(message: string): void {
    (this.options.log ?? console.warn)(message);
  }
}
