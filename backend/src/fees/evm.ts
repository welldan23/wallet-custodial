import {
  createPublicClient,
  encodeFunctionData,
  erc20Abi,
  http,
  type Address,
  type Chain,
  type Hex,
} from 'viem';
import { publicActionsL2 } from 'viem/op-stack';

import type { FeeEstimate, FeeEstimator, FeeMethod, FeeRequest } from './types.js';

/** Unit gas umum kalau simulasi gagal: transfer koin gas vs transfer ERC-20. */
export const DEFAULT_GAS_LIMIT = { native: 21_000n, erc20: 65_000n };
/**
 * Simulasi transfer 0 token lebih murah dari aslinya: penerima baru butuh
 * slot saldo baru (SSTORE 0 → bukan 0, sekitar 20 ribu gas). Tambahkan ini.
 */
export const ZERO_AMOUNT_BUFFER = 25_000n;
/** Alamat pengganti untuk simulasi saat pengirim tidak diketahui. */
const PLACEHOLDER_ACCOUNT: Address = '0x000000000000000000000000000000000000dEaD';

/** Margin 10% di atas hasil simulasi, seperti dompet pada umumnya. */
const withMargin = (gas: bigint) => (gas * 110n) / 100n;

type GasClient = {
  estimateFeesPerGas(): Promise<{ maxFeePerGas: bigint }>;
  estimateGas(args: { account: Address; to: Address; data?: Hex; value?: bigint }): Promise<bigint>;
  estimateL1Fee?(args: {
    account: Address;
    to: Address;
    data?: Hex;
    value?: bigint;
  }): Promise<bigint>;
};

/**
 * Estimasi biaya kirim di jaringan EVM: unit gas (disimulasikan kalau bisa)
 * × harga gas maksimal saat ini, ditambah biaya data L1 untuk jaringan
 * OP-stack (Base). Arbitrum sudah memasukkan komponen L1 di unit gasnya.
 */
export function createEvmFeeEstimator(
  chain: Chain,
  rpcUrl: string,
  options: { opStack?: boolean } = {},
): FeeEstimator {
  const base = createPublicClient({ chain, transport: http(rpcUrl, { retryCount: 1 }) });
  const client: GasClient = options.opStack ? base.extend(publicActionsL2()) : base;
  return evmFeeEstimatorFromClient(client);
}

export function evmFeeEstimatorFromClient(client: GasClient): FeeEstimator {
  return {
    async estimate({ token, from, to, amountRaw }: FeeRequest): Promise<FeeEstimate> {
      const recipient = (to ?? PLACEHOLDER_ACCOUNT) as Address;
      const isNative = token.contractAddress === null;
      const call = (amount: bigint) =>
        isNative
          ? { to: recipient, value: amount }
          : {
              to: token.contractAddress as Address,
              data: encodeFunctionData({
                abi: erc20Abi,
                functionName: 'transfer',
                args: [recipient, amount],
              }),
            };

      const { maxFeePerGas } = await client.estimateFeesPerGas();

      let method: FeeMethod = 'default';
      let gas = isNative ? DEFAULT_GAS_LIMIT.native : DEFAULT_GAS_LIMIT.erc20;
      let simulated = false;
      if (from && amountRaw !== undefined) {
        try {
          gas = withMargin(
            await client.estimateGas({ account: from as Address, ...call(amountRaw) }),
          );
          method = 'simulated';
          simulated = true;
        } catch {
          // Mis. saldo kurang: coba cara kira-kira di bawah.
        }
      }
      if (!simulated) {
        try {
          const zero = await client.estimateGas({
            account: (from ?? PLACEHOLDER_ACCOUNT) as Address,
            ...call(0n),
          });
          gas = withMargin(zero + (isNative ? 0n : ZERO_AMOUNT_BUFFER));
          method = 'approximate';
        } catch {
          // Tetap pakai angka umum.
        }
      }

      const execution = gas * maxFeePerGas;
      const parts: FeeEstimate['parts'] = [{ kind: 'execution', raw: execution }];
      if (client.estimateL1Fee) {
        const l1 = await client.estimateL1Fee({
          account: (from ?? PLACEHOLDER_ACCOUNT) as Address,
          ...call(amountRaw ?? 0n),
        });
        parts.push({ kind: 'l1_data', raw: l1 });
      }

      return {
        totalRaw: parts.reduce((sum, part) => sum + part.raw, 0n),
        parts,
        method,
        gasLimit: gas,
        maxFeePerGas,
      };
    },
  };
}
