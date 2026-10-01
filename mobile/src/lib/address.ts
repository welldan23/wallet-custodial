import type { Network, WalletAccounts } from '@/types/wallet';

/** Alamat penerima untuk satu jaringan (EVM berbagi satu alamat). */
export function addressForNetwork(accounts: WalletAccounts, network: Network): string {
  return network.chainType === 'solana' ? accounts.solana : accounts.evm;
}

/** `0x28348c…F4C0` — untuk tampilan ringkas. */
export function shortenAddress(address: string, head = 6, tail = 4): string {
  if (address.length <= head + tail + 1) return address;
  return `${address.slice(0, head)}…${address.slice(-tail)}`;
}

/**
 * Pecah alamat jadi kelompok 4 karakter supaya gampang dicocokkan.
 * Awalan `0x` alamat EVM jadi kelompok sendiri.
 */
export function groupAddress(address: string, size = 4): string[] {
  const hasHexPrefix = address.startsWith('0x');
  const body = hasHexPrefix ? address.slice(2) : address;
  const groups: string[] = [];
  for (let index = 0; index < body.length; index += size) {
    groups.push(body.slice(index, index + size));
  }
  return hasHexPrefix ? ['0x', ...groups] : groups;
}
