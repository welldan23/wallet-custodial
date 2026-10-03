import Ionicons from '@expo/vector-icons/Ionicons';
import { Platform, Pressable, Text, View } from 'react-native';

import { NetworkIcon } from '@/components/crypto/network-icon';
import { useI18n } from '@/i18n';
import { shortenAddress } from '@/lib/address';
import { avatarColorIndex, chainTypeOfAddress, contactInitials } from '@/lib/contacts';
import { useThemeColors } from '@/hooks/use-theme';
import type { Contact, Network } from '@/types/wallet';

const monoFont = Platform.select({ ios: 'Menlo', default: 'monospace' });
const AVATARS = [
  'bg-primary-500',
  'bg-teal-500',
  'bg-success-500',
  'bg-warning-500',
  'bg-ink-soft',
];

/** Satu kontak: avatar inisial, nama (+ bintang favorit), alamat singkat, jaringan. */
export function ContactRow({
  contact,
  network,
  isLast,
  onPress,
}: {
  contact: Contact;
  /** `null` = kontak berlaku di semua jaringan bertipe sama. */
  network: Network | null;
  isLast: boolean;
  onPress?: () => void;
}) {
  const colors = useThemeColors();
  const { t } = useI18n();
  const chainType = chainTypeOfAddress(contact.address);
  const networkLabel = network ? network.name : t.contacts.allNetworks[chainType];

  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={[
        contact.name,
        contact.isFavorite ? t.contacts.favorite : null,
        shortenAddress(contact.address),
        networkLabel,
      ]
        .filter(Boolean)
        .join(', ')}
      className={`flex-row items-center gap-3 py-3 active:opacity-70 ${isLast ? '' : 'border-b border-line'}`}>
      <View
        className={`h-11 w-11 items-center justify-center rounded-full ${AVATARS[avatarColorIndex(contact.name, AVATARS.length)]}`}>
        <Text className="text-sm font-bold text-white">{contactInitials(contact.name)}</Text>
      </View>
      <View className="flex-1 gap-0.5">
        <View className="flex-row items-center gap-1">
          <Text className="shrink text-[15px] font-semibold text-ink" numberOfLines={1}>
            {contact.name}
          </Text>
          {contact.isFavorite && <Ionicons name="star" size={13} color={colors.warning[500]} />}
        </View>
        <Text className="text-xs text-ink-muted" style={{ fontFamily: monoFont }}>
          {shortenAddress(contact.address)}
        </Text>
      </View>
      <View className="max-w-[40%] flex-row items-center gap-1 rounded-full bg-subtle px-2 py-1">
        {network ? (
          <NetworkIcon networkId={network.id} size={12} />
        ) : (
          <Ionicons name="git-network-outline" size={12} color={colors.ink.muted} />
        )}
        <Text className="shrink text-[11px] font-semibold text-ink-soft" numberOfLines={1}>
          {networkLabel}
        </Text>
      </View>
      {onPress && <Ionicons name="chevron-forward" size={16} color={colors.ink.faint} />}
    </Pressable>
  );
}
