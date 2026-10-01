import { Text, View } from 'react-native';

import type { Network } from '@/types/wallet';

import { NetworkIcon } from './network-icon';

type NetworkBadgesProps = {
  networks: Network[];
  /** Jumlah logo yang ditampilkan sebelum diringkas jadi "+N". */
  max?: number;
  size?: number;
};

/** Deretan logo jaringan kecil, mis. [ETH] [ARB] [BASE] +2. */
export function NetworkBadges({ networks, max = 3, size = 16 }: NetworkBadgesProps) {
  const visible = networks.slice(0, max);
  const hiddenCount = networks.length - visible.length;

  return (
    <View
      className="flex-row items-center gap-1"
      accessibilityLabel={networks.map((network) => network.name).join(', ')}>
      {visible.map((network) => (
        <NetworkIcon key={network.id} networkId={network.id} size={size} />
      ))}
      {hiddenCount > 0 && (
        <View className="rounded-full bg-subtle px-1.5 py-px">
          <Text className="text-[10px] font-semibold text-ink-muted">+{hiddenCount}</Text>
        </View>
      )}
    </View>
  );
}
