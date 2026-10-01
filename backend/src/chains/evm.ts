import { createPublicClient, erc20Abi, http, type Address, type Chain } from 'viem';
import { arbitrum, base, mainnet, polygon } from 'viem/chains';

import type { BalanceReader } from './types.js';

/** Pemetaan id jaringan → definisi chain viem (alamat Multicall3, dll). */
export const VIEM_CHAINS: Record<string, Chain> = {
  ethereum: mainnet,
  arbitrum,
  base,
  polygon,
};

/**
 * Baca saldo koin gas + token ERC-20 di satu jaringan EVM. Semua panggilan
 * `balanceOf` digabung jadi satu Multicall dan request JSON-RPC di-batch,
 * jadi cukup satu–dua request HTTP per jaringan.
 */
export function createEvmBalanceReader(chain: Chain, rpcUrl: string): BalanceReader {
  const client = createPublicClient({
    chain,
    transport: http(rpcUrl, { batch: true, retryCount: 1 }),
    batch: { multicall: true },
  });

  return {
    async read(owner, tokens) {
      const account = owner as Address;
      const raws = await Promise.all(
        tokens.map((token) =>
          token.contractAddress
            ? client.readContract({
                address: token.contractAddress as Address,
                abi: erc20Abi,
                functionName: 'balanceOf',
                args: [account],
              })
            : client.getBalance({ address: account }),
        ),
      );
      return tokens.map((token, index) => ({ tokenId: token.id, raw: raws[index] ?? 0n }));
    },
  };
}
