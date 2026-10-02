import { Platform, Text, View } from 'react-native';

import { useI18n } from '@/i18n';
import { cardShadow } from '@/theme/colors';

const monoFont = Platform.select({ ios: 'Menlo', default: 'monospace' });

/** 12 kata bernomor dalam dua kolom; `hidden` = disamarkan. */
export function MnemonicGrid({ words, hidden }: { words: string[]; hidden: boolean }) {
  const { t } = useI18n();
  return (
    <View
      className="flex-row flex-wrap rounded-[20px] bg-surface p-2"
      style={cardShadow}
      accessible={hidden}
      accessibilityLabel={hidden ? t.onboarding.wordsHiddenLabel : undefined}>
      {words.map((word, index) => (
        <View key={index} className="w-1/2 p-1.5">
          <View className="flex-row items-center gap-2 rounded-xl bg-subtle px-3 py-2.5">
            <Text className="w-5 text-right text-xs font-semibold text-ink-faint">{index + 1}</Text>
            <Text
              className={`flex-1 text-[15px] font-semibold ${hidden ? 'text-ink-faint' : 'text-ink'}`}
              style={{ fontFamily: monoFont }}
              accessibilityLabel={hidden ? undefined : t.onboarding.wordLabel(index + 1, word)}>
              {hidden ? '•••••' : word}
            </Text>
          </View>
        </View>
      ))}
    </View>
  );
}
