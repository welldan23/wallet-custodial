import { useI18n } from '@/i18n';
import type { KnownAddress } from '@/lib/lookalike';
import { MOCK_RECENT_RECIPIENTS } from '@/mocks/contacts';

import { useContacts } from './use-contacts';

/** Alamat yang sudah dikenal: kontak Buku Alamat + penerima sebelumnya. */
export function useKnownAddresses(): KnownAddress[] {
  const { t } = useI18n();
  const { contacts } = useContacts();
  return [
    ...contacts.map((contact) => ({ address: contact.address, label: contact.name })),
    ...MOCK_RECENT_RECIPIENTS.map((address) => ({ address, label: t.send.recentRecipient })),
  ];
}
