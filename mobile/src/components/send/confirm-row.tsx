import type { ReactNode } from 'react';
import { Text, View } from 'react-native';

/** Satu baris rincian di layar konfirmasi: label kiri, isi kanan. */
export function ConfirmRow({
  label,
  children,
  hint,
  isLast,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
  isLast?: boolean;
}) {
  return (
    <View
      className={`flex-row items-start justify-between gap-4 py-3 ${isLast ? '' : 'border-b border-line'}`}>
      <Text className="pt-0.5 text-[13px] text-ink-muted">{label}</Text>
      <View className="flex-1 items-end">
        {children}
        {hint && <Text className="mt-0.5 text-right text-[11px] text-ink-muted">{hint}</Text>}
      </View>
    </View>
  );
}
