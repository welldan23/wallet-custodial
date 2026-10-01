import type { Network, NetworkId } from '@/types/wallet';

/** Satu pilihan jaringan, dengan keterangan opsional (mis. aset yang didukung). */
export type NetworkOption = {
  network: Network;
  description?: string;
};

export type NetworkPickerProps = {
  options: NetworkOption[];
  selectedId: NetworkId | null;
  onSelect: (networkId: NetworkId) => void;
};
