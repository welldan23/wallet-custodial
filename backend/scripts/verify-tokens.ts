/**
 * Cek on-chain semua token di katalog: kontraknya ada, jumlah desimal
 * cocok, dan suplainya > 0. Jalankan tiap kali menambah/mengubah token:
 *   npm run verify:tokens
 */
import { address, createSolanaRpc } from '@solana/kit';
import { createPublicClient, erc20Abi, formatUnits, http, type Address } from 'viem';

import { MVP_NETWORKS, MVP_TOKENS } from '../src/catalog/mvp.js';
import { VIEM_CHAINS } from '../src/chains/evm.js';
import { loadConfig } from '../src/config.js';

const config = loadConfig();
let failures = 0;

const compactSupply = (value: string) =>
  Number(value).toLocaleString('en-US', { notation: 'compact', maximumFractionDigits: 2 });

for (const token of MVP_TOKENS) {
  if (!token.contractAddress) continue;
  const network = MVP_NETWORKS.find((item) => item.id === token.networkId);
  const rpcUrl = network && config.rpcUrls[network.id];
  if (!network || !rpcUrl) {
    console.log(`✗ ${token.id}: jaringan/RPC tidak ditemukan`);
    failures += 1;
    continue;
  }

  try {
    let symbol: string;
    let decimals: number;
    let supply: string;

    if (network.chainType === 'solana') {
      const rpc = createSolanaRpc(rpcUrl);
      const { value } = await rpc.getTokenSupply(address(token.contractAddress)).send();
      symbol = '(SPL)';
      decimals = value.decimals;
      supply = formatUnits(BigInt(value.amount), value.decimals);
    } else {
      const client = createPublicClient({
        chain: VIEM_CHAINS[network.id],
        transport: http(rpcUrl),
      });
      const contract = { address: token.contractAddress as Address, abi: erc20Abi } as const;
      const [onchainSymbol, onchainDecimals, totalSupply] = await Promise.all([
        client.readContract({ ...contract, functionName: 'symbol' }),
        client.readContract({ ...contract, functionName: 'decimals' }),
        client.readContract({ ...contract, functionName: 'totalSupply' }),
      ]);
      symbol = onchainSymbol;
      decimals = onchainDecimals;
      supply = formatUnits(totalSupply, onchainDecimals);
    }

    const ok = decimals === token.decimals && Number(supply) > 0;
    if (!ok) failures += 1;
    console.log(
      `${ok ? '✓' : '✗'} ${token.id.padEnd(15)} simbol=${symbol.padEnd(6)} desimal=${decimals} (katalog ${token.decimals}) suplai=${compactSupply(supply)}`,
    );
  } catch (error) {
    failures += 1;
    console.log(`✗ ${token.id}: gagal dibaca (${error instanceof Error ? error.name : 'unknown'})`);
  }
}

if (failures > 0) {
  console.log(`\n${failures} token bermasalah.`);
  process.exit(1);
}
console.log('\nSemua token cocok.');
