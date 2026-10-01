import type { Network, NetworkId, Price, Token, TokenBalance } from '@/types/wallet';

export type GasStatus = 'ok' | 'low' | 'empty';

/** Kalau gas cuma cukup untuk kurang dari ini, statusnya "menipis". */
export const LOW_GAS_TX_THRESHOLD = 3;

/** Saldo koin gas di satu jaringan, mis. ETH di Arbitrum. */
export type ChainGas = {
  network: Network;
  /** Simbol koin gas jaringan ini: ETH, POL, atau SOL. */
  symbol: string;
  amount: number;
  valueUsd: number;
  /** Perkiraan berapa kali kirim stablecoin yang masih bisa dibayar. */
  estimatedTxCount: number;
  status: GasStatus;
};

export type GasSummary = {
  /** Nilai semua koin gas di semua jaringan, dalam USD. */
  totalUsd: number;
  chains: ChainGas[];
  /** Jaringan yang gasnya menipis atau kosong. */
  needsTopUp: ChainGas[];
};

type GasInput = {
  networks: Network[];
  tokens: Token[];
  prices: Price[];
  balances: TokenBalance[];
  /** Perkiraan biaya 1 kali kirim stablecoin per jaringan (USD). */
  transferFeesUsd: Record<NetworkId, number>;
};

/**
 * Ringkas saldo gas: satu baris per jaringan aktif (termasuk yang kosong),
 * lengkap dengan perkiraan sisa transaksi dan statusnya.
 */
export function buildGasSummary({
  networks,
  tokens,
  prices,
  balances,
  transferFeesUsd,
}: GasInput): GasSummary {
  const priceBySymbol = new Map(prices.map((price) => [price.symbol, price.usdPrice]));
  const amountByTokenId = new Map<string, number>();
  for (const { tokenId, amount } of balances) {
    amountByTokenId.set(tokenId, (amountByTokenId.get(tokenId) ?? 0) + amount);
  }

  const chains = networks
    .filter((network) => network.isActive)
    .map((network): ChainGas => {
      const gasToken = tokens.find(
        (token) =>
          token.networkId === network.id &&
          token.symbol === network.nativeSymbol &&
          !token.isStablecoin,
      );
      const amount = Math.max(0, gasToken ? (amountByTokenId.get(gasToken.id) ?? 0) : 0);
      const valueUsd = amount * (priceBySymbol.get(network.nativeSymbol) ?? 0);
      const fee = transferFeesUsd[network.id];
      const estimatedTxCount = fee > 0 ? Math.floor(valueUsd / fee) : 0;
      const status: GasStatus =
        amount === 0 ? 'empty' : estimatedTxCount < LOW_GAS_TX_THRESHOLD ? 'low' : 'ok';

      return { network, symbol: network.nativeSymbol, amount, valueUsd, estimatedTxCount, status };
    });

  return {
    totalUsd: chains.reduce((sum, chain) => sum + chain.valueUsd, 0),
    chains,
    needsTopUp: chains.filter((chain) => chain.status !== 'ok'),
  };
}
