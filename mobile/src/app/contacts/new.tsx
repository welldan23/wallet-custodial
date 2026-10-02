import { router } from 'expo-router';

import { ContactForm } from '@/components/contacts/contact-form';
import { StackScreen } from '@/components/layout/stack-screen';
import { useToast } from '@/components/ui/toast';
import { useContacts } from '@/hooks/use-contacts';
import { useI18n } from '@/i18n';

/** Tambah kontak baru ke Buku Alamat. */
export default function NewContactScreen() {
  const { t } = useI18n();
  const toast = useToast();
  const { addContact } = useContacts();

  return (
    <StackScreen title={t.contacts.add}>
      <ContactForm
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
