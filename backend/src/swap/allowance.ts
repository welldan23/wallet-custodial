import { createPublicClient, erc20Abi, http, type Address } from 'viem';

import { VIEM_CHAINS } from '../chains/evm.js';

/** Baca izin (allowance) ERC-20 `owner` → `spender` di satu jaringan EVM. */
export type AllowanceReader = (
  networkId: string,
  token: string,
  owner: string,
  spender: string,
) => Promise<bigint>;

export function createAllowanceReader(rpcUrls: Record<string, string>): AllowanceReader {
  const clients = new Map<string, ReturnType<typeof createPublicClient>>();
  return async (networkId, token, owner, spender) => {
    let client = clients.get(networkId);
    if (!client) {
      const chain = VIEM_CHAINS[networkId];
      const rpcUrl = rpcUrls[networkId];
      if (!chain || !rpcUrl) throw new Error('no_rpc');
      client = createPublicClient({ chain, transport: http(rpcUrl, { retryCount: 1 }) });
      clients.set(networkId, client);
    }
    return client.readContract({
      address: token as Address,
      abi: erc20Abi,
      functionName: 'allowance',
      args: [owner as Address, spender as Address],
    });
  };
}
