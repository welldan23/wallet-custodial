import Ionicons from '@expo/vector-icons/Ionicons';
import { Modal, Pressable, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { NetworkIcon } from '@/components/crypto/network-icon';
import { DemoBanner } from '@/components/ui/demo-banner';
import { useShareAddress } from '@/hooks/use-share-address';
import { useWalletAccounts } from '@/hooks/use-wallet-accounts';
import { useI18n } from '@/i18n';
import { shortenAddress } from '@/lib/address';
import { useThemeColors } from '@/hooks/use-theme';
import type { Network } from '@/types/wallet';

import { AddressQr } from './address-qr';

type QrFullscreenProps = {
  visible: boolean;
  onClose: () => void;
  network: Network;
  address: string;
  symbols: string[];
};

/** QR ukuran besar di layar putih penuh, untuk ditunjukkan ke pengirim. */
export function QrFullscreen({ visible, onClose, network, address, symbols }: QrFullscreenProps) {
  const colors = useThemeColors();
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const share = useShareAddress();
  const { isDemo } = useWalletAccounts();
  const qrSize = Math.min(width - 96, 360);

  return (
    <Modal visible={visible} animationType="fade" onRequestClose={onClose}>
      <View
        className="flex-1 items-center bg-surface px-6"
        style={{ paddingTop: insets.top + 8, paddingBottom: insets.bottom + 16 }}>
        <View className="w-full max-w-[520px] flex-row justify-end">
          <Pressable
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel={t.common.close}
            className="h-11 w-11 items-center justify-center rounded-full bg-subtle active:opacity-70">
            <Ionicons name="close" size={22} color={colors.ink.DEFAULT} />
          </Pressable>
        </View>

        {isDemo && (
          <View className="mt-2 w-full max-w-[520px]">
            <DemoBanner message={t.receive.demoWarning} />
          </View>
        )}

        <View className="flex-1 items-center justify-center gap-5">
          <View className="flex-row items-center gap-2 rounded-full bg-primary-50 px-3.5 py-1.5">
            <NetworkIcon networkId={network.id} size={20} />
            <Text className="text-sm font-semibold text-primary-600">
              {t.receive.networkOnly(network.name)}
            </Text>
          </View>
          <AddressQr
            address={address}
            networkId={network.id}
            size={qrSize}
            accessibilityLabel={t.receive.qrLabel(network.name)}
          />
          <Text className="text-center text-base font-bold text-ink">
            {shortenAddress(address, 8, 6)}
          </Text>
          <Text className="text-center text-xs text-ink-muted">
            {t.receive.supportedAssets(symbols.join(' · '))}
          </Text>
        </View>

        <Pressable
          onPress={() => share(network, address, symbols)}
          accessibilityRole="button"
          accessibilityLabel={t.receive.share}
          className="w-full max-w-[520px] flex-row items-center justify-center gap-2 rounded-full bg-primary-500 py-3.5 active:opacity-80">
          <Ionicons name="share-outline" size={18} color={colors.white} />
          <Text className="text-[15px] font-semibold text-white">{t.receive.share}</Text>
        </Pressable>
      </View>
    </Modal>
  );
}
