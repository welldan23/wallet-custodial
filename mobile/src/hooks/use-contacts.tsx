import { createContext, use, useCallback, useMemo, useState, type ReactNode } from 'react';

import { MOCK_CONTACTS } from '@/mocks/contacts';
import type { Contact } from '@/types/wallet';

type ContactsContextValue = {
  contacts: Contact[];
  /** Simpan kontak baru dan kembalikan kontak lengkap dengan id-nya. */
  addContact: (contact: Omit<Contact, 'id'>) => Contact;
};

const ContactsContext = createContext<ContactsContextValue | null>(null);

const newContactId = () =>
  `kontak-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

/**
 * Buku Alamat di memori. Sementara diisi kontak contoh; nanti disinkronkan
 * ke backend `/v1/contacts` (layer backend fase 3).
 */
export function ContactsProvider({ children }: { children: ReactNode }) {
  const [contacts, setContacts] = useState<Contact[]>(MOCK_CONTACTS);

  const addContact = useCallback((input: Omit<Contact, 'id'>) => {
    const contact: Contact = { ...input, id: newContactId() };
    setContacts((current) => [...current, contact]);
    return contact;
  }, []);

  const value = useMemo(() => ({ contacts, addContact }), [contacts, addContact]);
  return <ContactsContext value={value}>{children}</ContactsContext>;
}

export function useContacts(): ContactsContextValue {
  const value = use(ContactsContext);
  if (!value) throw new Error('useContacts harus dipakai di dalam ContactsProvider');
  return value;
}
