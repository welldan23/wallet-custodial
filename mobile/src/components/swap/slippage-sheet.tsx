import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';

import { BottomSheet } from '@/components/ui/bottom-sheet';
import { useI18n } from '@/i18n';
import { checkSlippage, SLIPPAGE_PRESETS } from '@/lib/slippage';
import { colors } from '@/theme/colors';

type SlippageSheetProps = {
  visible: boolean;
  onClose: () => void;
  /** Slippage saat ini dalam persen. */
  value: number;
  onSave: (value: number) => void;
};

const isPreset = (value: number) => (SLIPPAGE_PRESETS as readonly number[]).includes(value);

/**
 * Atur slippage: tiga pilihan umum atau angka sendiri. Induk memberi `key`
 * baru tiap kali dibuka supaya isian mulai dari nilai yang tersimpan.
 */
export function SlippageSheet({ visible, onClose, value, onSave }: SlippageSheetProps) {
  const { t } = useI18n();
  const [preset, setPreset] = useState<number | null>(isPreset(value) ? value : null);
  const [custom, setCustom] = useState(isPreset(value) ? '' : String(value));

  const check = preset !== null ? null : checkSlippage(custom);
  const chosen = preset ?? (check?.status === 'valid' ? check.value : null);
  const warning = check?.status === 'valid' ? check.warning : null;
  const error = check?.status === 'invalid' ? t.swap.slippageError[check.reason] : null;

  const save = () => {
    if (chosen === null) return;
    onSave(chosen);
    onClose();
  };

  return (
    <BottomSheet visible={visible} onClose={onClose} title={t.swap.slippageTitle}>
      <Text className="mb-4 text-[13px] leading-5 text-ink-muted">{t.swap.slippageExplain}</Text>

      <View className="flex-row gap-2" accessibilityRole="radiogroup">
        {SLIPPAGE_PRESETS.map((item) => {
          const active = preset === item;
          return (
            <Pressable
              key={item}
              onPress={() => {
                setPreset(item);
                setCustom('');
              }}
              accessibilityRole="radio"
              aria-checked={active}
              accessibilityLabel={t.swap.slippageOption(item)}
              className={`flex-1 items-center justify-center rounded-2xl border py-3 active:opacity-70 ${
                active ? 'border-primary-500 bg-primary-50' : 'border-line bg-surface'
              }`}>
              <Text className={`text-[15px] font-bold ${active ? 'text-primary-500' : 'text-ink'}`}>
                {item}%
              </Text>
              {item === 0.5 && (
                <Text className="text-[10px] font-semibold text-ink-muted">
                  {t.swap.slippageRecommended}
                </Text>
              )}
            </Pressable>
          );
        })}
      </View>

      <Text className="mb-2 mt-4 text-[13px] font-semibold text-ink-muted">
        {t.swap.slippageCustom}
      </Text>
      <View
        className={`flex-row items-center rounded-2xl border px-4 ${
          error
            ? 'border-danger-500'
            : preset === null && custom
              ? 'border-primary-500'
              : 'border-line'
        }`}>
        <TextInput
          value={custom}
          onChangeText={(text) => {
            setCustom(text);
            setPreset(null);
          }}
          onFocus={() => setPreset(null)}
          placeholder={t.swap.slippageCustomPlaceholder}
          placeholderTextColor={colors.ink.faint}
          keyboardType="decimal-pad"
          inputMode="decimal"
          accessibilityLabel={t.swap.slippageCustom}
          className="min-h-[48px] flex-1 text-base font-semibold text-ink"
          style={{ outlineStyle: 'none' } as object}
        />
        <Text className="text-base font-bold text-ink-muted">%</Text>
      </View>

      {(error || warning) && (
        <View className="mt-2 flex-row items-start gap-1.5" accessibilityRole="alert">
          <Ionicons
            name={error ? 'close-circle' : 'warning'}
            size={15}
            color={error ? colors.danger[600] : colors.warning[600]}
          />
          <Text
            className={`flex-1 text-xs leading-[18px] ${error ? 'text-danger-600' : 'text-warning-600'}`}>
            {error ?? (warning === 'low' ? t.swap.slippageLowWarning : t.swap.slippageHighWarning)}
          </Text>
        </View>
      )}

      <Pressable
        onPress={save}
        disabled={chosen === null}
        accessibilityRole="button"
        accessibilityState={{ disabled: chosen === null }}
        className={`mt-5 items-center rounded-full py-4 ${
          chosen !== null ? 'bg-primary-500 active:opacity-80' : 'bg-line'
        }`}>
        <Text
          className={`text-base font-semibold ${chosen !== null ? 'text-white' : 'text-ink-faint'}`}>
          {t.swap.slippageSave}
        </Text>
      </Pressable>
    </BottomSheet>
  );
}
