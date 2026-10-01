import Ionicons from '@expo/vector-icons/Ionicons';
import * as Clipboard from 'expo-clipboard';
import { useEffect, useState } from 'react';
import { Pressable, Text } from 'react-native';

import { useToast } from '@/components/ui/toast';
import { useI18n } from '@/i18n';
import { shortenAddress } from '@/lib/address';
import { colors } from '@/theme/colors';
import type { Network } from '@/types/wallet';

type CopyAddressButtonProps = {
  address: string;
  network: Network;
};

/**
 * Salin alamat lengkap (persis, tanpa spasi pemisah) lalu tampilkan toast
 * berisi jaringan + potongan alamat supaya pengguna bisa mencocokkan.
 */
export function CopyAddressButton({ address, network }: CopyAddressButtonProps) {
  const { t } = useI18n();
  const toast = useToast();
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(timer);
  }, [copied]);

  const copy = async () => {
    try {
      const ok = await Clipboard.setStringAsync(address);
      if (!ok) throw new Error('clipboard_rejected');
      setCopied(true);
      toast({
        title: t.receive.copiedTitle(network.name),
        message: t.receive.copiedMessage(shortenAddress(address)),
      });
    } catch {
      toast({
        variant: 'error',
        title: t.receive.copyFailedTitle,
        message: t.receive.copyFailedMessage,
      });
    }
  };

  return (
    <Pressable
      onPress={copy}
      accessibilityRole="button"
      accessibilityLabel={copied ? t.receive.copied : t.receive.copyAddress}
      className={`w-full flex-row items-center justify-center gap-2 rounded-full py-3.5 active:opacity-80 ${
        copied ? 'bg-success-500' : 'bg-primary-500'
      }`}>
      <Ionicons name={copied ? 'checkmark' : 'copy-outline'} size={18} color={colors.surface} />
      <Text className="text-[15px] font-semibold text-white">
        {copied ? t.receive.copied : t.receive.copyAddress}
      </Text>
    </Pressable>
  );
}
