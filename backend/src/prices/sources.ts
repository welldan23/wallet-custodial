/**
 * Sumber harga & kurs dari API publik. Tiap sumber hanya mengembalikan
 * angka yang lolos validasi (angka positif, kurs IDR dalam rentang wajar).
 */

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

/** Simbol token → id CoinGecko (dipakai DefiLlama maupun CoinGecko). */
export const COINGECKO_IDS: Record<string, string> = {
  USDC: 'usd-coin',
  USDT: 'tether',
  DAI: 'dai',
  ETH: 'ethereum',
  POL: 'polygon-ecosystem-token',
  SOL: 'solana',
};

export type UsdPriceSource = {
  name: string;
  /** Harga USD per simbol. Simbol yang tidak ketemu tidak ada di hasil. */
  fetchUsdPrices(symbols: string[]): Promise<Map<string, number>>;
};

export type FxSource = {
  name: string;
  /** Kurs 1 USD → Rupiah. */
  fetchUsdToIdr(): Promise<number>;
};

type SourceOptions = { fetchImpl?: FetchLike; timeoutMs?: number };

/** Kurs USD→IDR di luar rentang ini dianggap data rusak. */
const IDR_RATE_RANGE = { min: 5_000, max: 50_000 } as const;

const isPositiveNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value > 0;

async function getJson(
  url: string,
  { fetchImpl = fetch, timeoutMs = 8_000 }: SourceOptions,
  headers?: Record<string, string>,
): Promise<unknown> {
  const response = await fetchImpl(url, {
    headers: { accept: 'application/json', ...headers },
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

function toIdsBySymbol(symbols: string[]): Map<string, string> {
  return new Map(
    symbols.flatMap((symbol) => {
      const id = COINGECKO_IDS[symbol];
      return id ? [[symbol, id] as const] : [];
    }),
  );
}

function assertIdrRate(rate: unknown): number {
  if (!isPositiveNumber(rate) || rate < IDR_RATE_RANGE.min || rate > IDR_RATE_RANGE.max) {
    throw new Error('Kurs IDR tidak valid');
  }
  return rate;
}

/** DefiLlama: gratis tanpa API key, satu request untuk semua token. */
export function defiLlamaSource(options: SourceOptions = {}): UsdPriceSource {
  return {
    name: 'defillama',
    async fetchUsdPrices(symbols) {
      const ids = toIdsBySymbol(symbols);
      if (ids.size === 0) return new Map();
      const keys = [...ids.values()].map((id) => `coingecko:${id}`).join(',');
      const body = (await getJson(`https://coins.llama.fi/prices/current/${keys}`, options)) as {
        coins?: Record<string, { price?: unknown; confidence?: unknown }>;
      };

      const prices = new Map<string, number>();
      for (const [symbol, id] of ids) {
        const coin = body.coins?.[`coingecko:${id}`];
        const lowConfidence = typeof coin?.confidence === 'number' && coin.confidence < 0.5;
        if (coin && isPositiveNumber(coin.price) && !lowConfidence) prices.set(symbol, coin.price);
      }
      return prices;
    },
  };
}

/** CoinGecko: cadangan. API key demo opsional supaya tidak gampang kena limit. */
export function coinGeckoSource(options: SourceOptions & { apiKey?: string } = {}): UsdPriceSource {
  return {
    name: 'coingecko',
    async fetchUsdPrices(symbols) {
      const ids = toIdsBySymbol(symbols);
      if (ids.size === 0) return new Map();
      const url = `https://api.coingecko.com/api/v3/simple/price?ids=${[...ids.values()].join(',')}&vs_currencies=usd`;
      const headers = options.apiKey ? { 'x-cg-demo-api-key': options.apiKey } : undefined;
      const body = (await getJson(url, options, headers)) as Record<string, { usd?: unknown }>;

      const prices = new Map<string, number>();
      for (const [symbol, id] of ids) {
        const usd = body[id]?.usd;
        if (isPositiveNumber(usd)) prices.set(symbol, usd);
      }
      return prices;
    },
  };
}

/** Frankfurter: kurs referensi Bank Sentral Eropa (ECB), update tiap hari kerja. */
export function frankfurterFxSource(options: SourceOptions = {}): FxSource {
  return {
    name: 'frankfurter',
    async fetchUsdToIdr() {
      const body = (await getJson(
        'https://api.frankfurter.dev/v1/latest?base=USD&symbols=IDR',
        options,
      )) as { rates?: { IDR?: unknown } };
      return assertIdrRate(body.rates?.IDR);
    },
  };
}

/** open.er-api.com (ExchangeRate-API versi gratis): cadangan kurs. */
export function openErApiFxSource(options: SourceOptions = {}): FxSource {
  return {
    name: 'open-er-api',
    async fetchUsdToIdr() {
      const body = (await getJson('https://open.er-api.com/v6/latest/USD', options)) as {
        result?: unknown;
        rates?: { IDR?: unknown };
      };
      if (body.result !== 'success') throw new Error('Respons kurs gagal');
      return assertIdrRate(body.rates?.IDR);
    },
  };
}
