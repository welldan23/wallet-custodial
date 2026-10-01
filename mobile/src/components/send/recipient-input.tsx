import Ionicons from '@expo/vector-icons/Ionicons';
import * as Clipboard from 'expo-clipboard';
import { Platform, Pressable, Text, TextInput, View } from 'react-native';

import { useToast } from '@/components/ui/toast';
import { useI18n } from '@/i18n';
import type { RecipientCheck } from '@/lib/address-validation';
import { cardShadow, colors } from '@/theme/colors';
import type { Network } from '@/types/wallet';

type RecipientInputProps = {
  value: string;
  onChange: (value: string) => void;
  network: Network;
  check: RecipientCheck;
  /** Nama kontak kalau alamat dipilih dari Buku Alamat. */
  contactName?: string | null;
  onOpenScanner: () => void;
  onOpenContacts: () => void;
};

const monoFont = Platform.select({ ios: 'Menlo', default: 'monospace' });

/** Kolom alamat tujuan dengan tombol tempel/hapus dan hasil validasi jaringan. */
export function RecipientInput({
  value,
  onChange,
  network,
  check,
  contactName,
  onOpenScanner,
  onOpenContacts,
}: RecipientInputProps) {
  const { t } = useI18n();
  const toast = useToast();

  const paste = async () => {
    try {
      const text = await Clipboard.getStringAsync();
      if (text) onChange(text.trim());
    } catch {
      toast({ variant: 'error', title: t.send.pasteFailed });
    }
  };

  const invalid = check.status === 'invalid';
  const borderClass = invalid
    ? 'border-danger-500'
    : check.status === 'valid'
      ? 'border-success-500'
      : 'border-line';

  return (
    <View className="rounded-[20px] bg-surface px-4 py-3.5" style={cardShadow}>
      <Text className="mb-2 text-[13px] font-semibold text-ink-muted">
        {t.send.recipientLabel(network.name)}
      </Text>

      <View
        className={`flex-row items-center gap-2 rounded-2xl border bg-subtle px-3 py-2 ${borderClass}`}>
        <TextInput
          value={value}
          onChangeText={onChange}
          placeholder={network.chainType === 'evm' ? '0x…' : t.send.solanaPlaceholder}
          placeholderTextColor={colors.ink.faint}
          autoCapitalize="none"
          autoCorrect={false}
          spellCheck={false}
          multiline
          accessibilityLabel={t.send.recipientLabel(network.name)}
          className="min-h-[44px] flex-1 py-1.5 text-[15px] text-ink"
          style={[{ fontFamily: monoFont }, { outlineStyle: 'none' } as object]}
        />
        {value ? (
          <Pressable
            onPress={() => onChange('')}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={t.send.clearAddress}>
            <Ionicons name="close-circle" size={20} color={colors.ink.faint} />
          </Pressable>
        ) : (
          <Pressable
            onPress={paste}
            accessibilityRole="button"
            accessibilityLabel={t.send.paste}
            className="rounded-full bg-primary-50 px-3 py-1.5 active:opacity-70">
            <Text className="text-xs font-semibold text-primary-500">{t.send.paste}</Text>
          </Pressable>
        )}
      </View>

      {contactName && (
        <View className="mt-2 flex-row items-center gap-1.5 self-start rounded-full bg-primary-50 px-2.5 py-1">
          <Ionicons name="person" size={12} color={colors.primary[600]} />
          <Text className="text-xs font-semibold text-primary-600">{contactName}</Text>
        </View>
      )}
      <RecipientFeedback check={check} network={network} />

      <View className="mt-3 flex-row gap-2.5">
        <SourceButton icon="scan-outline" label={t.send.scanQr} onPress={onOpenScanner} />
        <SourceButton icon="book-outline" label={t.send.addressBook} onPress={onOpenContacts} />
      </View>
    </View>
  );
}

function RecipientFeedback({ check, network }: { check: RecipientCheck; network: Network }) {
  const { t } = useI18n();
  if (check.status === 'empty') return null;

  const tone =
    check.status === 'invalid' ? 'danger' : check.warning === 'own_address' ? 'warning' : 'success';
  const message =
    check.status === 'invalid'
      ? t.send.invalidReason[check.reason](network.name)
      : check.warning === 'own_address'
        ? t.send.ownAddressWarning
        : t.send.validAddress(network.name);
  const icon =
    tone === 'danger' ? 'close-circle' : tone === 'warning' ? 'warning' : 'checkmark-circle';
  const color =
    tone === 'danger'
      ? colors.danger[600]
      : tone === 'warning'
        ? colors.warning[600]
        : colors.success[600];

  return (
    <View
      className="mt-2 flex-row items-start gap-1.5"
      accessibilityRole={tone === 'success' ? undefined : 'alert'}
      accessibilityLiveRegion="polite">
      <Ionicons name={icon} size={16} color={color} />
      <Text className="flex-1 text-xs leading-[18px]" style={{ color }}>
        {message}
      </Text>
    </View>
  );
}

type SourceButtonProps = {
  icon: 'scan-outline' | 'book-outline';
  label: string;
  onPress: () => void;
};

function SourceButton({ icon, label, onPress }: SourceButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      className="flex-1 flex-row items-center justify-center gap-1.5 rounded-full border border-line bg-surface py-2.5 active:opacity-70">
      <Ionicons name={icon} size={16} color={colors.primary[500]} />
      <Text className="text-[13px] font-semibold text-primary-500">{label}</Text>
    </Pressable>
  );
}
