import type { ActivityItem } from '@/hooks/use-activity';
import type { NetworkId } from '@/types/wallet';

export type HistoryType = 'send' | 'receive' | 'swap';
/** Sama dengan kolom `status` tabel `transactions` di PRD. */
export type HistoryStatus = 'pending' | 'success' | 'failed';

/** Satu baris riwayat — bentuknya mengikuti tabel `transactions` di PRD. */
export type HistoryItem = {
  id: string;
  type: HistoryType;
  status: HistoryStatus;
  symbol: string;
  isStablecoin: boolean;
  networkId: NetworkId;
  amount: number;
  amountUsd: number;
  /** Biaya jaringan dalam koin gas; 0 untuk transaksi masuk (dibayar pengirim). */
  fee: number;
  feeUsd: number;
  /** Alamat lawan transaksi (penerima/pengirim); `null` untuk swap. */
  counterparty: string | null;
  /** Nama kontak kalau alamatnya dikenal. */
  counterpartyLabel?: string;
  txHash: string;
  createdAt: string;
  /** Sisi tujuan, khusus swap. */
  swap?: { toSymbol: string; toNetworkId: NetworkId; toAmount: number; provider: string };
  /** Berasal dari aktivitas sesi ini (punya layar status sendiri). */
  isLocal?: boolean;
};

/** Ubah aktivitas sesi ini (kirim/swap) ke bentuk baris riwayat. */
export function activityToHistory(item: ActivityItem): HistoryItem {
  const status: HistoryStatus = item.status === 'confirmed' ? 'success' : 'pending';
  if (item.kind === 'swap') {
    return {
      id: item.id,
      type: 'swap',
      status,
      symbol: item.fromSymbol,
      isStablecoin: true,
      networkId: item.fromNetworkId,
      amount: item.fromAmount,
      amountUsd: item.amountUsd,
      fee: item.feeNative,
      feeUsd: item.feeUsd + item.bridgeFeeUsd,
      counterparty: null,
      txHash: item.txHash,
      createdAt: item.createdAt,
      swap: {
        toSymbol: item.toSymbol,
        toNetworkId: item.toNetworkId,
        toAmount: item.toAmount,
        provider: item.provider,
      },
      isLocal: true,
    };
  }
  return {
    id: item.id,
    type: 'send',
    status,
    symbol: item.symbol,
    isStablecoin: item.isStablecoin,
    networkId: item.networkId,
    amount: item.amount,
    amountUsd: item.amountUsd,
    fee: item.feeNative,
    feeUsd: item.feeUsd,
    counterparty: item.to,
    counterpartyLabel: item.contact,
    txHash: item.txHash,
    createdAt: item.createdAt,
    isLocal: true,
  };
}

export type HistoryDayGroup = {
  /** `YYYY-MM-DD` waktu lokal HP. */
  day: string;
  items: HistoryItem[];
};

const pad = (value: number) => String(value).padStart(2, '0');

/** Tanggal lokal `YYYY-MM-DD` dari string ISO. */
export function localDay(iso: string): string {
  const date = new Date(iso);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Urutkan terbaru dulu lalu kelompokkan per hari (waktu lokal). */
export function groupByDay(items: HistoryItem[]): HistoryDayGroup[] {
  const sorted = [...items].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const groups: HistoryDayGroup[] = [];
  for (const item of sorted) {
    const day = localDay(item.createdAt);
    const last = groups[groups.length - 1];
    if (last?.day === day) last.items.push(item);
    else groups.push({ day, items: [item] });
  }
  return groups;
}

/** Selisih hari kalender antara `day` dan hari ini (0 = hari ini, 1 = kemarin). */
export function daysAgo(day: string, now: Date = new Date()): number {
  const [y, m, d] = day.split('-').map(Number);
  const then = new Date(y, m - 1, d);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((today.getTime() - then.getTime()) / 86_400_000);
}

export type HistoryAmountLine = {
  sign: '+' | '−';
  amount: number;
  symbol: string;
  isStablecoin: boolean;
};

/**
 * Angka utama baris riwayat: swap → koin yang diterima (+) dan yang
 * ditukar (−); terima → (+); kirim → (−). Transaksi gagal tidak mengubah
 * saldo, jadi tetap ditampilkan tapi dicoret.
 */
export function historyAmounts(item: HistoryItem): {
  main: HistoryAmountLine;
  swapped?: HistoryAmountLine;
} {
  if (item.type === 'swap' && item.swap) {
    return {
      main: {
        sign: '+',
        amount: item.swap.toAmount,
        symbol: item.swap.toSymbol,
        isStablecoin: true,
      },
      swapped: {
        sign: '−',
        amount: item.amount,
        symbol: item.symbol,
        isStablecoin: item.isStablecoin,
      },
    };
  }
  return {
    main: {
      sign: item.type === 'receive' ? '+' : '−',
      amount: item.amount,
      symbol: item.symbol,
      isStablecoin: item.isStablecoin,
    },
  };
}

/** Bulan lokal `YYYY-MM` dari string ISO. */
export const localMonth = (iso: string) => localDay(iso).slice(0, 7);

/**
 * Bulan untuk pilihan filter, terbaru dulu: bulan ini selalu ada, lalu
 * semua bulan yang punya transaksi.
 */
export function availableMonths(items: HistoryItem[], now: Date = new Date()): string[] {
  const current = `${now.getFullYear()}-${pad(now.getMonth() + 1)}`;
  const months = new Set([current, ...items.map((item) => localMonth(item.createdAt))]);
  return [...months].sort().reverse();
}

/** `null` = semua bulan. */
export function filterByMonth(items: HistoryItem[], month: string | null): HistoryItem[] {
  if (!month) return items;
  return items.filter((item) => localMonth(item.createdAt) === month);
}

export type HistorySummary = {
  count: number;
  /** Nilai USD yang masuk (terima, berhasil). */
  inUsd: number;
  /** Nilai USD yang keluar (kirim berhasil/diproses + semua biaya jaringan). */
  outUsd: number;
  swaps: number;
  pending: number;
  failed: number;
};

/** Ringkasan sekumpulan transaksi (mis. satu bulan). Transaksi gagal cuma dihitung biayanya. */
export function summarizeHistory(items: HistoryItem[]): HistorySummary {
  const summary: HistorySummary = {
    count: items.length,
    inUsd: 0,
    outUsd: 0,
    swaps: 0,
    pending: 0,
    failed: 0,
  };
  for (const item of items) {
    if (item.status === 'pending') summary.pending += 1;
    if (item.status === 'failed') summary.failed += 1;
    if (item.type === 'swap') summary.swaps += 1;
    summary.outUsd += item.feeUsd;
    if (item.status === 'failed') continue;
    if (item.type === 'receive') summary.inUsd += item.amountUsd;
    if (item.type === 'send') summary.outUsd += item.amountUsd;
  }
  return summary;
}

/** Validasi `YYYY-MM` dari URL; selain itu dianggap "Semua". */
export const parseMonthParam = (value: unknown): string | null =>
  typeof value === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(value) ? value : null;
