import { VIEM_CHAINS } from '../chains/evm.js';
import type { Network } from '../types.js';

import { createEvmFeeEstimator } from './evm.js';
import { createSolanaFeeEstimator } from './solana.js';
import type { FeeEstimator } from './types.js';

/** Jaringan OP-stack yang punya biaya data L1 terpisah. */
const OP_STACK_NETWORKS = new Set(['base']);

/** Siapkan penghitung biaya untuk tiap jaringan yang punya URL RPC. */
export function createFeeEstimators(
  networks: Network[],
  rpcUrls: Record<string, string>,
): Map<string, FeeEstimator> {
  const estimators = new Map<string, FeeEstimator>();
  for (const network of networks) {
    const rpcUrl = rpcUrls[network.id];
    if (!rpcUrl) continue;
    if (network.chainType === 'solana') {
      estimators.set(network.id, createSolanaFeeEstimator(rpcUrl));
      continue;
    }
    const chain = VIEM_CHAINS[network.id];
    if (chain) {
      estimators.set(
        network.id,
        createEvmFeeEstimator(chain, rpcUrl, { opStack: OP_STACK_NETWORKS.has(network.id) }),
      );
    }
  }
  return estimators;
}
