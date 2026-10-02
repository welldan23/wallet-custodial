import { usePreventScreenCapture } from 'expo-screen-capture';
import { Platform } from 'react-native';

function PreventCapture() {
  usePreventScreenCapture('mnemonic');
  return null;
}

/** Blokir screenshot & rekam layar selama komponen ini tampil (Android/iOS). */
export function NoScreenCapture() {
  return Platform.OS === 'web' ? null : <PreventCapture />;
}
