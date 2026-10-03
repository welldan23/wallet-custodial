import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { Platform, Pressable, Text, View } from 'react-native';

import { NetworkIcon } from '@/components/crypto/network-icon';
import { useShareAddress } from '@/hooks/use-share-address';
import { useI18n } from '@/i18n';
import { groupAddress } from '@/lib/address';
import { useThemeColors } from '@/hooks/use-theme';
import { cardShadow } from '@/theme/colors';
import type { Network } from '@/types/wallet';

import { AddressQr } from './address-qr';
import { CopyAddressButton } from './copy-address-button';
import { NetworkWarning } from './network-warning';
import { QrFullscreen } from './qr-fullscreen';

type AddressCardProps = {
  network: Network;
  address: string;
  /** Aset yang bisa diterima di jaringan ini. */
  symbols: string[];
};

const monoFont = Platform.select({ ios: 'Menlo', default: 'monospace' });

/**
 * Alamat penerima untuk jaringan terpilih. Alamat dipecah per 4 karakter;
 * kelompok awal & akhir ditebalkan karena bagian itulah yang biasa dicocokkan.
 */
export function AddressCard({ network, address, symbols }: AddressCardProps) {
  const { t } = useI18n();
  const groups = groupAddress(address);
  const share = useShareAddress();
  const [qrOpen, setQrOpen] = useState(false);

  return (
    <View className="items-center rounded-[20px] bg-surface px-5 pb-5 pt-4" style={cardShadow}>
      <View className="flex-row items-center gap-2">
        <NetworkIcon networkId={network.id} size={22} />
        <Text className="text-base font-bold text-ink">{t.receive.addressTitle(network.name)}</Text>
      </View>
      <Text className="mt-1 text-xs text-ink-muted">
        {t.receive.supportedAssets(symbols.join(' · '))}
      </Text>

      <View className="mt-4">
        <AddressQr
          address={address}
          networkId={network.id}
          accessibilityLabel={t.receive.enlargeQrLabel(network.name)}
          onPress={() => setQrOpen(true)}
        />
      </View>
      <Text className="mt-2 text-xs font-semibold text-ink-soft">
        {t.receive.qrCaption(network.name)}
      </Text>

      <View className="mt-4 w-full rounded-2xl bg-subtle px-4 py-3.5">
        <Text
          selectable
          accessibilityLabel={address}
          className="text-center text-[15px] leading-6 text-ink-muted"
          style={{ fontFamily: monoFont }}>
          {groups.map((group, index) => {
            // Untuk EVM, "0x" + 4 karakter sesudahnya sama-sama ditebalkan.
            const firstGroupIndex = groups[0] === '0x' ? 1 : 0;
            const emphasized = index <= firstGroupIndex || index === groups.length - 1;
            return (
              <Text key={index} className={emphasized ? 'font-bold text-ink' : undefined}>
                {group}
                {index < groups.length - 1 ? ' ' : ''}
              </Text>
            );
          })}
        </Text>
      </View>

      <View className="mt-4 w-full gap-2.5">
        <CopyAddressButton address={address} network={network} />
        <View className="flex-row gap-2.5">
          <SecondaryButton
            icon="expand-outline"
            label={t.receive.enlargeQr}
            onPress={() => setQrOpen(true)}
          />
          <SecondaryButton
            icon="share-outline"
            label={t.receive.share}
            onPress={() => share(network, address, symbols)}
          />
        </View>
      </View>

      <QrFullscreen
        visible={qrOpen}
        onClose={() => setQrOpen(false)}
        network={network}
        address={address}
        symbols={symbols}
      />

      <View className="mt-4 w-full">
        <NetworkWarning network={network} symbols={symbols} />
      </View>
    </View>
  );
}

type SecondaryButtonProps = {
  icon: 'expand-outline' | 'share-outline';
  label: string;
  onPress: () => void;
};

function SecondaryButton({ icon, label, onPress }: SecondaryButtonProps) {
  const colors = useThemeColors();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      className="flex-1 flex-row items-center justify-center gap-1.5 rounded-full border border-line bg-surface py-3 active:opacity-70">
      <Ionicons name={icon} size={17} color={colors.primary[500]} />
      <Text className="text-sm font-semibold text-primary-500">{label}</Text>
    </Pressable>
  );
}
