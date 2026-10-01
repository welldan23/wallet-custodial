import * as Clipboard from 'expo-clipboard';

import { useToast } from '@/components/ui/toast';
import { useI18n } from '@/i18n';

/** Salin teks lalu tampilkan toast berhasil/gagal. */
export function useCopy() {
  const { t } = useI18n();
  const toast = useToast();

  return async (value: string, title: string, message?: string) => {
    try {
      if (!(await Clipboard.setStringAsync(value))) throw new Error('clipboard_rejected');
      toast({ title, message });
    } catch {
      toast({
        variant: 'error',
        title: t.receive.copyFailedTitle,
        message: t.receive.copyFailedMessage,
      });
    }
  };
}
