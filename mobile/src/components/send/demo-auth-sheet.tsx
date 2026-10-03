import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, Text, View } from 'react-native';

import { BottomSheet } from '@/components/ui/bottom-sheet';
import { useI18n } from '@/i18n';
import { useThemeColors } from '@/hooks/use-theme';

type DemoAuthSheetProps = {
  visible: boolean;
  onClose: () => void;
  onApprove: () => void;
};

/**
 * Pengganti prompt biometrik HANYA untuk mode demo di platform tanpa
 * sensor (preview web). Di HP selalu memakai sidik jari/FaceID asli.
 */
export function DemoAuthSheet({ visible, onClose, onApprove }: DemoAuthSheetProps) {
  const colors = useThemeColors();
  const { t } = useI18n();

  return (
    <BottomSheet visible={visible} onClose={onClose} title={t.send.demoAuthTitle}>
      <View className="items-center gap-3 pb-2 pt-2">
        <View className="h-16 w-16 items-center justify-center rounded-full bg-primary-50">
          <Ionicons name="finger-print" size={34} color={colors.primary[500]} />
        </View>
        <Text className="text-center text-sm leading-5 text-ink-soft">{t.send.demoAuthBody}</Text>
        <Pressable
          onPress={() => {
            onClose();
            onApprove();
          }}
          accessibilityRole="button"
          className="mt-2 w-full items-center rounded-full bg-primary-500 py-3.5 active:opacity-80">
          <Text className="text-[15px] font-semibold text-white">{t.send.demoAuthApprove}</Text>
        </Pressable>
      </View>
    </BottomSheet>
  );
}
