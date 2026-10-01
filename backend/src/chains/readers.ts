import type { Network } from '../types.js';

import { createEvmBalanceReader, VIEM_CHAINS } from './evm.js';
import { createSolanaBalanceReader } from './solana.js';
import type { BalanceReader } from './types.js';

/**
 * Siapkan pembaca saldo untuk tiap jaringan yang punya URL RPC.
 * Jaringan tanpa pembaca akan berstatus `unsupported` di ringkasan.
 */
export function createBalanceReaders(
  networks: Network[],
  rpcUrls: Record<string, string>,
): Map<string, BalanceReader> {
  const readers = new Map<string, BalanceReader>();

  for (const network of networks) {
    const rpcUrl = rpcUrls[network.id];
    if (!rpcUrl) continue;

    if (network.chainType === 'solana') {
      readers.set(network.id, createSolanaBalanceReader(rpcUrl));
      continue;
    }
    const chain = VIEM_CHAINS[network.id];
    if (chain) readers.set(network.id, createEvmBalanceReader(chain, rpcUrl));
  }

  return readers;
}
