import Ionicons from '@expo/vector-icons/Ionicons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRef } from 'react';
import { Modal, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useI18n } from '@/i18n';
import { useThemeColors } from '@/hooks/use-theme';

type QrScannerModalProps = {
  visible: boolean;
  onClose: () => void;
  /** Dipanggil sekali per pembukaan dengan isi QR mentah. */
  onScanned: (data: string) => void;
};

/** Pemindai QR layar penuh dengan bingkai bidik; minta izin kamera saat perlu. */
export function QrScannerModal({ visible, onClose, onScanned }: QrScannerModalProps) {
  const colors = useThemeColors();
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  const [permission, requestPermission] = useCameraPermissions();
  const handled = useRef(false);

  const close = () => {
    handled.current = false;
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={close}>
      <View className="flex-1 bg-black">
        {permission?.granted ? (
          <CameraView
            style={{ flex: 1 }}
            facing="back"
            barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
            onBarcodeScanned={({ data }) => {
              if (handled.current) return;
              handled.current = true;
              onScanned(data);
              close();
            }}
          />
        ) : (
          <View className="flex-1 items-center justify-center gap-4 px-8">
            <Ionicons name="camera-outline" size={44} color={colors.white} />
            <Text className="text-center text-base font-semibold text-white">
              {permission && !permission.canAskAgain
                ? t.send.cameraDeniedTitle
                : t.send.cameraPermissionTitle}
            </Text>
            <Text className="text-center text-sm leading-5 text-white/70">
              {t.send.cameraPermissionBody}
            </Text>
            {(!permission || permission.canAskAgain) && (
              <Pressable
                onPress={requestPermission}
                accessibilityRole="button"
                className="rounded-full bg-primary-500 px-6 py-3 active:opacity-80">
                <Text className="text-[15px] font-semibold text-white">{t.send.allowCamera}</Text>
              </Pressable>
            )}
          </View>
        )}

        {permission?.granted && (
          <View pointerEvents="none" className="absolute inset-0 items-center justify-center">
            <View className="h-64 w-64 rounded-3xl border-4 border-white/90" />
            <Text className="mt-5 text-sm font-semibold text-white">{t.send.scanHint}</Text>
          </View>
        )}

        <Pressable
          onPress={close}
          accessibilityRole="button"
          accessibilityLabel={t.common.close}
          className="absolute right-4 h-11 w-11 items-center justify-center rounded-full bg-black/50"
          style={{ top: insets.top + 8 }}>
          <Ionicons name="close" size={24} color={colors.white} />
        </Pressable>
      </View>
    </Modal>
  );
}
