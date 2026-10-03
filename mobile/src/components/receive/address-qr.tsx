import { Pressable, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';

import { NetworkIcon } from '@/components/crypto/network-icon';
import { lightColors } from '@/theme/colors';
import type { NetworkId } from '@/types/wallet';

const QR_DARK = lightColors.ink.DEFAULT;
const QR_LIGHT = lightColors.white;

type AddressQrProps = {
  /** Isi QR: alamat polos supaya terbaca semua wallet & exchange. */
  address: string;
  networkId: NetworkId;
  size?: number;
  accessibilityLabel: string;
  /** Kalau diisi, QR bisa diketuk (mis. untuk diperbesar). */
  onPress?: () => void;
};

/**
 * QR alamat dengan logo jaringan di tengah. Koreksi error level H supaya
 * QR tetap terbaca walau bagian tengahnya tertutup logo.
 */
export function AddressQr({
  address,
  networkId,
  size = 200,
  accessibilityLabel,
  onPress,
}: AddressQrProps) {
  const logoSize = Math.round(size * 0.2);

  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      // QR selalu gelap di atas putih (juga di mode gelap) supaya kamera mana pun bisa membacanya.
      className="items-center justify-center rounded-3xl border border-line p-3 active:opacity-80"
      style={{ backgroundColor: QR_LIGHT }}
      accessible
      accessibilityRole={onPress ? 'button' : 'image'}
      accessibilityLabel={accessibilityLabel}>
      <QRCode value={address} size={size} ecl="H" color={QR_DARK} backgroundColor={QR_LIGHT} />
      <View
        pointerEvents="none"
        className="absolute items-center justify-center rounded-full"
        style={{ width: logoSize + 8, height: logoSize + 8, backgroundColor: QR_LIGHT }}>
        <NetworkIcon networkId={networkId} size={logoSize} />
      </View>
    </Pressable>
  );
}
