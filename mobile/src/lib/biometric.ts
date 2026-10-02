import { authenticateAsync, getEnrolledLevelAsync, SecurityLevel } from 'expo-local-authentication';
import { Platform } from 'react-native';

/**
 * - `success`: lolos sidik jari/FaceID (atau PIN/pola layar sebagai cadangan)
 * - `cancelled`: pengguna membatalkan
 * - `no_lock`: HP tidak punya kunci layar sama sekali → transaksi ditolak
 * - `lockout`: terlalu banyak percobaan gagal
 * - `failed`: gagal karena alasan lain
 * - `unsupported`: platform tanpa biometrik (mis. web)
 */
export type SigningAuthResult =
  | 'success'
  | 'cancelled'
  | 'no_lock'
  | 'lockout'
  | 'failed'
  | 'unsupported';

/**
 * Minta verifikasi biometrik sebelum menandatangani transaksi. Kalau
 * biometrik tidak ada, sistem memakai PIN/pola layar sebagai cadangan;
 * HP tanpa kunci layar sama sekali ditolak.
 */
export async function authorizeSigning(
  promptMessage: string,
  cancelLabel: string,
  { requireConfirmation = true }: { requireConfirmation?: boolean } = {},
): Promise<SigningAuthResult> {
  if (Platform.OS === 'web') return 'unsupported';
  try {
    const level = await getEnrolledLevelAsync();
    if (level === SecurityLevel.NONE) return 'no_lock';

    const result = await authenticateAsync({
      promptMessage,
      cancelLabel,
      disableDeviceFallback: false,
      requireConfirmation,
    });
    if (result.success) return 'success';

    switch (result.error) {
      case 'user_cancel':
      case 'system_cancel':
      case 'app_cancel':
      case 'user_fallback':
        return 'cancelled';
      case 'lockout':
        return 'lockout';
      case 'not_enrolled':
      case 'passcode_not_set':
        return 'no_lock';
      default:
        return 'failed';
    }
  } catch {
    return 'failed';
  }
}
