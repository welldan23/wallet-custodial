import { View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';

import { NetworkIcon } from '@/components/crypto/network-icon';
import { colors } from '@/theme/colors';
import type { NetworkId } from '@/types/wallet';

type AddressQrProps = {
  /** Isi QR: alamat polos supaya terbaca semua wallet & exchange. */
  address: string;
  networkId: NetworkId;
  size?: number;
  accessibilityLabel: string;
};

/**
 * QR alamat dengan logo jaringan di tengah. Koreksi error level H supaya
 * QR tetap terbaca walau bagian tengahnya tertutup logo.
 */
export function AddressQr({ address, networkId, size = 200, accessibilityLabel }: AddressQrProps) {
  const logoSize = Math.round(size * 0.2);

  return (
    <View
      className="items-center justify-center rounded-3xl border border-line bg-surface p-3"
      accessible
      accessibilityRole="image"
      accessibilityLabel={accessibilityLabel}>
      <QRCode
        value={address}
        size={size}
        ecl="H"
        color={colors.ink.DEFAULT}
        backgroundColor={colors.surface}
      />
      <View
        pointerEvents="none"
        className="absolute items-center justify-center rounded-full bg-surface"
        style={{ width: logoSize + 8, height: logoSize + 8 }}>
        <NetworkIcon networkId={networkId} size={logoSize} />
      </View>
    </View>
  );
}
