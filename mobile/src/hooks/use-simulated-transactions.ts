/**
 * `true` selama kirim/swap/riwayat masih memakai data tiruan (aplikasi belum
 * disambung ke backend). Terpisah dari `isDemo` alamat: walau wallet sudah
 * asli, transaksi tetap simulasi — jadi banner mode demo harus tetap tampil.
 */
export function useSimulatedTransactions(): boolean {
  return true;
}
