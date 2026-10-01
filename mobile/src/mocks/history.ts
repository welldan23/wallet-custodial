/**
 * RIWAYAT TIRUAN — beberapa bulan transaksi contoh (terima, kirim, swap)
 * supaya halaman Riwayat bisa dibangun sebelum indexer/backend siap.
 * Alamat dan hash cuma contoh.
 */
import type { HistoryItem } from '@/lib/history';

import { MOCK_CONTACTS } from './contacts';
import type { MockWalletScenario } from './wallet';

const contact = (id: string) => MOCK_CONTACTS.find((item) => item.id === id)!;
const tokocrypto = contact('kontak-tokocrypto');
const tabungan = contact('kontak-rekening-sendiri');
const budi = contact('kontak-budi');
const indodax = contact('kontak-indodax');

const hash = (seed: string) => `0x${seed.repeat(64).slice(0, 64)}`;
const solSig = (seed: string) =>
  `${seed}5VERv8NMvzbJMEkV8xnrLkEaWRtSz2CosKDYVCJgeRCxyHqSKFcdxMSuyU6m3sVUJVTUvHN`.slice(0, 88);

const BASE: HistoryItem[] = [
  {
    id: 'h-01',
    type: 'receive',
    status: 'success',
    symbol: 'USDC',
    isStablecoin: true,
    networkId: 'arbitrum',
    amount: 500,
    amountUsd: 499.95,
    fee: 0,
    feeUsd: 0,
    counterparty: tokocrypto.address,
    counterpartyLabel: tokocrypto.name,
    txHash: hash('a1'),
    createdAt: '2026-10-01T02:15:00.000Z',
  },
  {
    id: 'h-02',
    type: 'send',
    status: 'pending',
    symbol: 'USDT',
    isStablecoin: true,
    networkId: 'polygon',
    amount: 25,
    amountUsd: 25.01,
    fee: 0.012,
    feeUsd: 0.005,
    counterparty: tabungan.address,
    counterpartyLabel: tabungan.name,
    txHash: hash('b2'),
    createdAt: '2026-10-01T01:40:00.000Z',
  },
  {
    id: 'h-03',
    type: 'swap',
    status: 'success',
    symbol: 'USDT',
    isStablecoin: true,
    networkId: 'arbitrum',
    amount: 80,
    amountUsd: 80.02,
    fee: 0.0000134,
    feeUsd: 0.04,
    counterparty: null,
    txHash: hash('c3'),
    createdAt: '2026-09-30T09:05:00.000Z',
    swap: { toSymbol: 'USDC', toNetworkId: 'arbitrum', toAmount: 80.02, provider: 'LI.FI' },
  },
  {
    id: 'h-04',
    type: 'send',
    status: 'success',
    symbol: 'USDC',
    isStablecoin: true,
    networkId: 'solana',
    amount: 45,
    amountUsd: 45,
    fee: 0.0000066,
    feeUsd: 0.001,
    counterparty: budi.address,
    counterpartyLabel: budi.name,
    txHash: solSig('4f'),
    createdAt: '2026-09-30T04:20:00.000Z',
  },
  {
    id: 'h-05',
    type: 'send',
    status: 'failed',
    symbol: 'USDC',
    isStablecoin: true,
    networkId: 'ethereum',
    amount: 60,
    amountUsd: 60,
    fee: 0.00018,
    feeUsd: 0.54,
    counterparty: indodax.address,
    counterpartyLabel: indodax.name,
    txHash: hash('d4'),
    createdAt: '2026-09-27T13:30:00.000Z',
  },
  {
    id: 'h-06',
    type: 'receive',
    status: 'success',
    symbol: 'SOL',
    isStablecoin: false,
    networkId: 'solana',
    amount: 0.25,
    amountUsd: 38.08,
    fee: 0,
    feeUsd: 0,
    counterparty: '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM',
    txHash: solSig('6a'),
    createdAt: '2026-09-21T06:00:00.000Z',
  },
  {
    id: 'h-07',
    type: 'swap',
    status: 'success',
    symbol: 'USDC',
    isStablecoin: true,
    networkId: 'base',
    amount: 150,
    amountUsd: 149.99,
    fee: 0.0000067,
    feeUsd: 0.02,
    counterparty: null,
    txHash: hash('e5'),
    createdAt: '2026-09-14T08:45:00.000Z',
    swap: { toSymbol: 'USDC', toNetworkId: 'arbitrum', toAmount: 149.59, provider: 'LI.FI' },
  },
  {
    id: 'h-08',
    type: 'receive',
    status: 'success',
    symbol: 'ETH',
    isStablecoin: false,
    networkId: 'arbitrum',
    amount: 0.02,
    amountUsd: 59.61,
    fee: 0,
    feeUsd: 0,
    counterparty: tokocrypto.address,
    counterpartyLabel: tokocrypto.name,
    txHash: hash('f6'),
    createdAt: '2026-09-02T03:10:00.000Z',
  },
  {
    id: 'h-09',
    type: 'receive',
    status: 'success',
    symbol: 'USDT',
    isStablecoin: true,
    networkId: 'ethereum',
    amount: 150,
    amountUsd: 150.03,
    fee: 0,
    feeUsd: 0,
    counterparty: indodax.address,
    counterpartyLabel: indodax.name,
    txHash: hash('07'),
    createdAt: '2026-08-28T10:00:00.000Z',
  },
  {
    id: 'h-10',
    type: 'send',
    status: 'success',
    symbol: 'USDT',
    isStablecoin: true,
    networkId: 'arbitrum',
    amount: 30,
    amountUsd: 30.01,
    fee: 0.0000067,
    feeUsd: 0.02,
    counterparty: '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045',
    txHash: hash('18'),
    createdAt: '2026-08-19T15:25:00.000Z',
  },
  {
    id: 'h-11',
    type: 'receive',
    status: 'success',
    symbol: 'USDC',
    isStablecoin: true,
    networkId: 'base',
    amount: 350,
    amountUsd: 349.97,
    fee: 0,
    feeUsd: 0,
    counterparty: tokocrypto.address,
    counterpartyLabel: tokocrypto.name,
    txHash: hash('29'),
    createdAt: '2026-08-05T07:50:00.000Z',
  },
];

const SCENARIO_HISTORY: Record<MockWalletScenario, HistoryItem[]> = {
  funded: BASE,
  empty: [],
  // Belum punya koin gas → belum pernah kirim/swap, cuma terima stablecoin.
  'no-gas': BASE.filter((item) => item.type === 'receive' && item.isStablecoin),
};

export function getMockHistory(
  scenario: string | undefined = process.env.EXPO_PUBLIC_MOCK_WALLET,
): HistoryItem[] {
  return SCENARIO_HISTORY[scenario as MockWalletScenario] ?? BASE;
}
