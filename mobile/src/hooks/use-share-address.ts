import * as Clipboard from 'expo-clipboard';
import { Share } from 'react-native';

import { useToast } from '@/components/ui/toast';
import { useI18n } from '@/i18n';
import type { Network } from '@/types/wallet';

/**
 * Bagikan alamat lewat menu share bawaan HP. Pesan selalu menyebut
 * jaringan supaya pengirim tidak salah pilih. Kalau menu share tidak
 * tersedia (mis. sebagian browser), alamat disalin sebagai gantinya.
 */
export function useShareAddress() {
  const { t } = useI18n();
  const toast = useToast();

  return async (network: Network, address: string, symbols: string[]) => {
    const message = t.receive.shareMessage(network.name, symbols.join(', '), address);
    try {
      await Share.share({ message, title: t.receive.shareTitle(network.name) });
    } catch {
      try {
        await Clipboard.setStringAsync(address);
        toast({ title: t.receive.shareFallbackTitle, message: t.receive.shareFallbackMessage });
      } catch {
        toast({
          variant: 'error',
          title: t.receive.copyFailedTitle,
          message: t.receive.copyFailedMessage,
        });
      }
    }
  };
}
