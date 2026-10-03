import Ionicons from '@expo/vector-icons/Ionicons';
import { Platform, Pressable, Text, View } from 'react-native';

import { useI18n } from '@/i18n';
import { differingIndexes, type LookalikeMatch } from '@/lib/lookalike';
import { useThemeColors } from '@/hooks/use-theme';

const monoFont = Platform.select({ ios: 'Menlo', default: 'monospace' });

/** Alamat dengan karakter yang berbeda dari pembanding ditandai merah. */
function DiffAddress({ address, other, label }: { address: string; other: string; label: string }) {
  const colors = useThemeColors();
  const diff = differingIndexes(address, other);
  return (
    <View className="gap-0.5">
      <Text className="text-[11px] font-semibold text-ink-muted">{label}</Text>
      <Text className="text-xs leading-5 text-ink" style={{ fontFamily: monoFont }} selectable>
        {[...address].map((char, index) => (
          <Text
            key={index}
            className={diff.has(index) ? 'font-bold text-danger-600' : undefined}
            style={diff.has(index) ? { backgroundColor: colors.danger[50] } : undefined}>
            {char}
          </Text>
        ))}
      </Text>
    </View>
  );
}

type LookalikeWarningProps = {
  recipient: string;
  match: LookalikeMatch;
  /** Kalau diisi, tampil centang konfirmasi ulang. */
  acknowledged?: boolean;
  onAcknowledge?: (value: boolean) => void;
};

/**
 * Peringatan address poisoning: alamat tujuan mirip (awal & akhir sama)
 * dengan alamat yang dikenal, tapi BERBEDA. Dua alamat dibandingkan dan
 * karakter yang berbeda ditandai.
 */
export function LookalikeWarning({
  recipient,
  match,
  acknowledged,
  onAcknowledge,
}: LookalikeWarningProps) {
  const colors = useThemeColors();
  const { t } = useI18n();

  return (
    <View
      className="gap-3 rounded-2xl border border-danger-500/40 bg-danger-50 px-4 py-3.5"
      accessibilityRole="alert">
      <View className="flex-row items-start gap-2">
        <Ionicons name="warning" size={18} color={colors.danger[600]} />
        <View className="flex-1">
          <Text className="text-sm font-bold text-danger-600">{t.send.lookalikeTitle}</Text>
          <Text className="mt-0.5 text-[13px] leading-5 text-ink-soft">
            {t.send.lookalikeBody(match.known.label)}
          </Text>
        </View>
      </View>

      <View className="gap-2 rounded-xl bg-surface px-3 py-2.5">
        <DiffAddress
          address={recipient}
          other={match.known.address}
          label={t.send.lookalikeYours}
        />
        <DiffAddress
          address={match.known.address}
          other={recipient}
          label={t.send.lookalikeKnown(match.known.label)}
        />
      </View>

      {onAcknowledge && (
        <Pressable
          onPress={() => onAcknowledge(!acknowledged)}
          accessibilityRole="checkbox"
          aria-checked={!!acknowledged}
          className="flex-row items-start gap-2.5 active:opacity-70">
          <Ionicons
            name={acknowledged ? 'checkbox' : 'square-outline'}
            size={22}
            color={acknowledged ? colors.danger[600] : colors.ink.muted}
          />
          <Text className="flex-1 text-[13px] font-semibold leading-5 text-ink">
            {t.send.lookalikeAcknowledge}
          </Text>
        </Pressable>
      )}
    </View>
  );
}

/** Info positif: alamat persis sama dengan kontak/penerima sebelumnya. */
export function KnownRecipientNote({ label }: { label: string }) {
  const colors = useThemeColors();
  const { t } = useI18n();
  return (
    <View className="flex-row items-center gap-1.5 px-1">
      <Ionicons name="shield-checkmark" size={15} color={colors.success[600]} />
      <Text className="flex-1 text-xs font-semibold text-success-600">
        {t.send.knownRecipient(label)}
      </Text>
    </View>
  );
}
