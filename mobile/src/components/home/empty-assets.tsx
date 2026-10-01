import { Ionicons } from '@expo/vector-icons';
import { Pressable, Text, View } from 'react-native';

import { NetworkIcon } from '@/components/crypto/network-icon';
import { useI18n } from '@/i18n';
import { cardShadow, colors } from '@/theme/colors';
import type { Network } from '@/types/wallet';

type EmptyAssetsProps = {
  /** Jaringan yang didukung, ditampilkan sebagai logo kecil. */
  networks: Network[];
  /** Kalau diisi, muncul tombol "Terima Aset". */
  onReceive?: () => void;
};

/** Pengganti daftar aset saat wallet belum punya aset sama sekali. */
export function EmptyAssets({ networks, onReceive }: EmptyAssetsProps) {
  const { t } = useI18n();

  return (
    <View className="items-center rounded-[20px] bg-surface px-6 py-8" style={cardShadow}>
      <View className="h-16 w-16 items-center justify-center rounded-full bg-primary-50">
        <Ionicons name="wallet-outline" size={30} color={colors.primary[500]} />
      </View>

      <Text className="mt-4 text-[17px] font-bold text-ink">{t.home.emptyTitle}</Text>
      <Text className="mt-1.5 text-center text-sm leading-5 text-ink-muted">
        {t.home.emptyDescription}
      </Text>

      <View className="mt-5 items-center gap-2">
        <Text className="text-xs font-medium text-ink-faint">{t.home.supportedNetworks}</Text>
        <View
          className="flex-row gap-2"
          accessibilityLabel={networks.map((network) => network.name).join(', ')}>
          {networks.map((network) => (
            <NetworkIcon key={network.id} networkId={network.id} size={24} />
          ))}
        </View>
      </View>

      {onReceive && (
        <Pressable
          onPress={onReceive}
          accessibilityRole="button"
          className="mt-6 w-full flex-row items-center justify-center gap-2 rounded-full bg-primary-500 py-3.5 active:opacity-80">
          <Ionicons name="arrow-down" size={18} color={colors.surface} />
          <Text className="text-[15px] font-semibold text-white">{t.home.emptyCta}</Text>
        </Pressable>
      )}
    </View>
  );
}
