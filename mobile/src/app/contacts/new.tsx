import { router, useLocalSearchParams } from 'expo-router';

import { ContactForm } from '@/components/contacts/contact-form';
import { StackScreen } from '@/components/layout/stack-screen';
import { useToast } from '@/components/ui/toast';
import { useContacts } from '@/hooks/use-contacts';
import { useI18n } from '@/i18n';
import { guessChainType } from '@/lib/contact-form';

/** Tambah kontak baru ke Buku Alamat. `?address=` mengisi alamat, mis. dari layar Kirim. */
export default function NewContactScreen() {
  const { t } = useI18n();
  const toast = useToast();
  const { addContact } = useContacts();
  const params = useLocalSearchParams<{ address?: string }>();
  const prefill = params.address?.trim() ?? '';
  const initial = prefill
    ? {
        name: '',
        address: prefill,
        scope: guessChainType(prefill) === 'solana' ? ('solana' as const) : ('all_evm' as const),
        isFavorite: false,
      }
    : undefined;

  return (
    <StackScreen title={t.contacts.add}>
      <ContactForm
        initial={initial}
        submitLabel={t.contacts.form.save}
        onSubmit={(input) => {
          const contact = addContact(input);
          toast({ variant: 'success', title: t.contacts.form.saved(contact.name) });
          router.back();
        }}
      />
    </StackScreen>
  );
}
