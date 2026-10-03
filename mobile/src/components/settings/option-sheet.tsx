import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, Text, View } from 'react-native';

import { BottomSheet } from '@/components/ui/bottom-sheet';
import { colors } from '@/theme/colors';

export type SettingOption<T extends string | number> = {
  value: T;
  label: string;
  /** Keterangan kecil di bawah label, mis. contoh tampilan. */
  hint?: string;
};

type OptionSheetProps<T extends string | number> = {
  visible: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  options: SettingOption<T>[];
  selected: T;
  onSelect: (value: T) => void;
};

/** Lembar pilihan tunggal untuk satu pengaturan; memilih langsung menutup lembar. */
export function OptionSheet<T extends string | number>({
  visible,
  onClose,
  title,
  description,
  options,
  selected,
  onSelect,
}: OptionSheetProps<T>) {
  return (
    <BottomSheet visible={visible} onClose={onClose} title={title}>
      {description && (
        <Text className="mb-2 text-[13px] leading-5 text-ink-muted">{description}</Text>
      )}
      <View accessibilityRole="radiogroup" className="gap-2 pb-2">
        {options.map((option) => {
          const active = option.value === selected;
          return (
            <Pressable
              key={String(option.value)}
              onPress={() => {
                onSelect(option.value);
                onClose();
              }}
              accessibilityRole="radio"
              aria-checked={active}
              accessibilityLabel={[option.label, option.hint].filter(Boolean).join(', ')}
              className={`flex-row items-center gap-3 rounded-2xl border px-4 py-3.5 active:opacity-70 ${
                active ? 'border-primary-500 bg-primary-50' : 'border-line bg-surface'
              }`}>
              <View className="flex-1 gap-0.5">
                <Text
                  className={`text-[15px] font-semibold ${active ? 'text-primary-600' : 'text-ink'}`}>
                  {option.label}
                </Text>
                {option.hint && <Text className="text-xs text-ink-muted">{option.hint}</Text>}
              </View>
              <Ionicons
                name={active ? 'radio-button-on' : 'radio-button-off'}
                size={22}
                color={active ? colors.primary[500] : colors.ink.faint}
              />
            </Pressable>
          );
        })}
      </View>
    </BottomSheet>
  );
}
