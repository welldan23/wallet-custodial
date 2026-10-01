import Ionicons from '@expo/vector-icons/Ionicons';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';

import { useI18n } from '@/i18n';
import { shortenAddress } from '@/lib/address';
import { formatTokenAmount, MASKED_VALUE } from '@/lib/format';
import type { SentTransfer } from '@/lib/sent-transfers';
import { cardShadow, colors } from '@/theme/colors';

type RecentTransferCardProps = {
  transfer: SentTransfer;
  networkName: string;
  hidden: boolean;
  onOpen: () => void;
  onDismiss: () => void;
};

/** Info kiriman terakhir di Home: masih diproses atau sudah terkirim. */
export function RecentTransferCard({
  transfer,
  networkName,
  hidden,
  onOpen,
  onDismiss,
}: RecentTransferCardProps) {
  const { t } = useI18n();
  const confirmed = transfer.status === 'confirmed';
  const amount = hidden ? MASKED_VALUE : formatTokenAmount(transfer.amount, transfer.isStablecoin);
  const title = confirmed
    ? t.home.transferConfirmed(amount, transfer.symbol)
    : t.home.transferPending(amount, transfer.symbol);
  const recipient = transfer.contact ?? shortenAddress(transfer.to);

  return (
    <View
      className="flex-row items-center rounded-[20px] bg-surface pr-2"
      style={cardShadow}
      accessibilityLiveRegion="polite">
      <Pressable
        onPress={onOpen}
        accessibilityRole="button"
        accessibilityLabel={`${title}. ${t.home.transferTo(recipient, networkName)}. ${t.home.transferOpen}`}
        className="flex-1 flex-row items-center gap-3 py-3.5 pl-4 active:opacity-70">
        <View
          className={`h-10 w-10 items-center justify-center rounded-full ${
            confirmed ? 'bg-success-50' : 'bg-primary-50'
          }`}>
          {confirmed ? (
            <Ionicons name="checkmark" size={22} color={colors.success[500]} />
          ) : (
            <ActivityIndicator size="small" color={colors.primary[500]} />
          )}
        </View>
        <View className="flex-1">
          <Text className="text-sm font-semibold text-ink" numberOfLines={1}>
            {title}
          </Text>
          <Text className="text-xs text-ink-muted" numberOfLines={1}>
            {t.home.transferTo(recipient, networkName)}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={16} color={colors.ink.faint} />
      </Pressable>
      {confirmed && (
        <Pressable
          onPress={onDismiss}
          hitSlop={6}
          accessibilityRole="button"
          accessibilityLabel={t.home.transferDismiss}
          className="ml-1 h-9 w-9 items-center justify-center rounded-full active:bg-black/5">
          <Ionicons name="close" size={18} color={colors.ink.muted} />
        </Pressable>
      )}
    </View>
  );
}
