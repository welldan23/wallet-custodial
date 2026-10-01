import { address, createSolanaRpc } from '@solana/kit';

import type { BalanceReader } from './types.js';

/** Program SPL Token (klasik) — USDC & USDT di Solana memakai program ini. */
export const SPL_TOKEN_PROGRAM_ADDRESS = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA';

/**
 * Baca saldo SOL + token SPL milik satu alamat. Semua akun token diambil
 * sekali jalan lalu dijumlah per mint (satu pemilik bisa punya >1 akun).
 */
export function createSolanaBalanceReader(rpcUrl: string): BalanceReader {
  const rpc = createSolanaRpc(rpcUrl);

  return {
    async read(owner, tokens) {
      const ownerAddress = address(owner);
      const needsNative = tokens.some((token) => !token.contractAddress);
      const needsSpl = tokens.some((token) => token.contractAddress);

      const [lamports, tokenAccounts] = await Promise.all([
        needsNative ? rpc.getBalance(ownerAddress).send() : null,
        needsSpl
          ? rpc
              .getTokenAccountsByOwner(
                ownerAddress,
                { programId: address(SPL_TOKEN_PROGRAM_ADDRESS) },
                { encoding: 'jsonParsed' },
              )
              .send()
          : null,
      ]);

      const rawByMint = new Map<string, bigint>();
      for (const { account } of tokenAccounts?.value ?? []) {
        const { mint, tokenAmount } = account.data.parsed.info;
        rawByMint.set(mint, (rawByMint.get(mint) ?? 0n) + BigInt(tokenAmount.amount));
      }

      return tokens.map((token) => ({
        tokenId: token.id,
        raw: token.contractAddress
          ? (rawByMint.get(token.contractAddress) ?? 0n)
          : (lamports?.value ?? 0n),
      }));
    },
  };
}

/** Pemilik (wallet) sebuah akun token SPL; `null` kalau akun tidak ada. */
export function createTokenAccountOwnerResolver(rpcUrl: string) {
  const rpc = createSolanaRpc(rpcUrl);
  return async (tokenAccount: string): Promise<string | null> => {
    const info = await rpc.getAccountInfo(address(tokenAccount), { encoding: 'jsonParsed' }).send();
    const data = info.value?.data as { parsed?: { info?: { owner?: string } } } | undefined;
    return data?.parsed?.info?.owner ?? null;
  };
}
