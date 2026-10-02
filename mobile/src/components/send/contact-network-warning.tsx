import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, Text, View } from 'react-native';

import { NetworkIcon } from '@/components/crypto/network-icon';
import { useI18n } from '@/i18n';
import { colors } from '@/theme/colors';
import type { Network } from '@/types/wallet';

type ContactNetworkWarningProps = {
  contactName: string;
  /** Jaringan yang disimpan di kontak. */
  usual: Network;
  /** Jaringan aset yang mau dikirim. */
  current: Network;
  /** Ganti aset ke jaringan kontak; kosong kalau aset itu tidak ada di sana. */
  onSwitch?: () => void;
  /** Kalau diisi, tampil centang "sudah dicek" yang wajib sebelum lanjut. */
  acknowledged?: boolean;
  onAcknowledge?: (value: boolean) => void;
};

/**
 * Kontak disimpan untuk satu jaringan (mis. alamat deposit exchange di Ethereum),
 * tapi dipakai untuk kirim di jaringan lain. Alamat EVM-nya sama, jadi transaksi
 * tetap jalan, padahal exchange bisa saja tidak memproses jaringan itu.
 */
export function ContactNetworkWarning({
  contactName,
  usual,
  current,
  onSwitch,
  acknowledged,
  onAcknowledge,
}: ContactNetworkWarningProps) {
  const { t } = useI18n();
  const copy = t.send.contactNetwork;

  return (
    <View
      className="gap-3 rounded-2xl border border-warning-500/40 bg-warning-50 px-4 py-3.5"
      accessibilityRole="alert">
      <View className="flex-row items-start gap-2">
        <Ionicons name="warning" size={18} color={colors.warning[600]} />
        <View className="flex-1 gap-0.5">
          <Text className="text-sm font-bold text-warning-600">
            {copy.title(usual.name, current.name)}
          </Text>
          <Text className="text-[13px] leading-5 text-ink-soft">
            {copy.body(contactName, usual.name, current.name)}
          </Text>
        </View>
      </View>

      <View className="flex-row items-center gap-2 rounded-xl bg-surface px-3 py-2.5">
        <NetworkIcon networkId={usual.id} size={16} />
        <Text className="text-xs font-semibold text-ink">{usual.name}</Text>
        <Ionicons name="arrow-forward" size={14} color={colors.ink.faint} />
        <NetworkIcon networkId={current.id} size={16} />
        <Text className="text-xs font-semibold text-warning-600">{current.name}</Text>
      </View>

      {onSwitch && (
        <Pressable
          onPress={onSwitch}
          accessibilityRole="button"
          className="flex-row items-center justify-center gap-1.5 rounded-full bg-surface py-2.5 active:opacity-70">
          <Ionicons name="swap-horizontal" size={16} color={colors.primary[500]} />
          <Text className="text-[13px] font-semibold text-primary-500">
            {copy.switchTo(usual.name)}
          </Text>
        </Pressable>
      )}

      {onAcknowledge && (
        <Pressable
          onPress={() => onAcknowledge(!acknowledged)}
          accessibilityRole="checkbox"
          aria-checked={!!acknowledged}
          className="flex-row items-start gap-2.5 active:opacity-70">
          <Ionicons
            name={acknowledged ? 'checkbox' : 'square-outline'}
            size={22}
            color={acknowledged ? colors.warning[600] : colors.ink.muted}
          />
          <Text className="flex-1 text-[13px] font-semibold leading-5 text-ink">
            {copy.acknowledge(current.name)}
          </Text>
        </Pressable>
      )}
    </View>
  );
}
