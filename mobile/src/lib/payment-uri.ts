export type ScannedAddress = {
  /** Alamat penerima hasil scan (belum divalidasi). */
  address: string;
  /** Chain ID EVM kalau QR-nya menyebutkan (EIP-681 `@chainId`). */
  chainId?: string;
  scheme?: 'ethereum' | 'solana';
};

/**
 * Ambil alamat penerima dari isi QR. Mendukung alamat polos, URI EIP-681
 * (`ethereum:0x…@42161`, termasuk transfer token
 * `ethereum:<token>@<chain>/transfer?address=<penerima>`), dan Solana Pay
 * (`solana:<alamat>?amount=…`).
 */
export function parseScannedAddress(raw: string): ScannedAddress {
  const value = raw.trim();

  const ethereum = /^ethereum:(?:pay-)?([^@/?]+)(?:@(\d+))?(?:\/([^?]+))?(?:\?(.*))?$/i.exec(value);
  if (ethereum) {
    const [, target = '', chainId, fn, query] = ethereum;
    const params = new URLSearchParams(query ?? '');
    // Transfer token: target = kontrak token, penerima ada di ?address=
    const recipient = fn === 'transfer' ? params.get('address') : null;
    return { address: recipient ?? target, chainId, scheme: 'ethereum' };
  }

  const solana = /^solana:([^?]+)/i.exec(value);
  if (solana) return { address: solana[1] ?? '', scheme: 'solana' };

  return { address: value };
}
