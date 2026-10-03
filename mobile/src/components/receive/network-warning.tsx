import Ionicons from '@expo/vector-icons/Ionicons';
import { Text, View } from 'react-native';

import { useI18n } from '@/i18n';
import { COMMON_UNSUPPORTED_NETWORKS, EXCHANGE_NETWORK_LABELS } from '@/lib/network-labels';
import { useThemeColors } from '@/hooks/use-theme';
import type { Network } from '@/types/wallet';

type NetworkWarningProps = {
  network: Network;
  /** Aset yang didukung di jaringan ini. */
  symbols: string[];
};

/**
 * Penerima tidak bisa melihat jaringan yang dipilih pengirim, jadi
 * peringatan ditampilkan sebelum dikirim: label jaringan versi exchange,
 * jaringan yang tidak didukung, dan aset yang tidak akan tampil.
 */
export function NetworkWarning({ network, symbols }: NetworkWarningProps) {
  const colors = useThemeColors();
  const { t } = useI18n();

  return (
    <View
      className="w-full gap-2.5 rounded-2xl border border-warning-500/40 bg-warning-50 px-4 py-3.5"
      accessibilityRole="alert">
      <View className="flex-row items-center gap-2">
        <Ionicons name="warning" size={18} color={colors.warning[600]} />
        <Text className="flex-1 text-sm font-bold text-warning-600">
          {t.receive.warningTitle(network.name)}
        </Text>
      </View>

      <Text className="text-[13px] leading-5 text-ink-soft">
        {t.receive.warningExchangeLabel}{' '}
        <Text className="font-bold text-ink">{EXCHANGE_NETWORK_LABELS[network.id]}</Text>
      </Text>
      <Text className="text-[13px] leading-5 text-ink-soft">
        {t.receive.warningUnsupported(COMMON_UNSUPPORTED_NETWORKS.join(', '))}
      </Text>
      <Text className="text-[13px] leading-5 text-ink-soft">
        {t.receive.warningAssets(symbols.join(', '), network.name)}
      </Text>
      {network.chainType === 'evm' && (
        <Text className="text-[13px] leading-5 text-ink-soft">
          {t.receive.sharedEvmAddressNote}
        </Text>
      )}
    </View>
  );
}
