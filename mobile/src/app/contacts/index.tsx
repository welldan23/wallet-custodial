import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';

import { ContactRow } from '@/components/contacts/contact-row';
import { StackScreen } from '@/components/layout/stack-screen';
import { useContacts } from '@/hooks/use-contacts';
import { useSupportedNetworks } from '@/hooks/use-supported-networks';
import { useI18n } from '@/i18n';
import { contactNetwork, filterContacts, groupContacts } from '@/lib/contacts';
import { cardShadow, colors } from '@/theme/colors';
import type { Contact } from '@/types/wallet';

/** Buku Alamat: cari, favorit dulu, lalu semua kontak A–Z. */
export default function ContactsScreen() {
  const { t } = useI18n();
  const { contacts } = useContacts();
  const networks = useSupportedNetworks().map((item) => item.network);
  const [query, setQuery] = useState('');
  const { favorites, others } = groupContacts(filterContacts(contacts, query));

  const section = (title: string, items: Contact[]) =>
    items.length > 0 && (
      <View className="gap-2">
        <Text className="px-1 text-[13px] font-semibold text-ink-soft" accessibilityRole="header">
          {title}
        </Text>
        <View className="rounded-[20px] bg-surface px-4" style={cardShadow}>
          {items.map((contact, index) => (
            <ContactRow
              key={contact.id}
              contact={contact}
              network={contactNetwork(contact, networks)}
              isLast={index === items.length - 1}
              onPress={() =>
                router.push({ pathname: '/contacts/[id]', params: { id: contact.id } })
              }
            />
          ))}
        </View>
      </View>
    );

  return (
    <StackScreen title={t.contacts.title}>
      <View
        className="flex-row items-center gap-2 rounded-full bg-surface px-4 py-2.5"
        style={cardShadow}>
        <Ionicons name="search" size={18} color={colors.ink.faint} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder={t.contacts.search}
          placeholderTextColor={colors.ink.faint}
          autoCorrect={false}
          autoCapitalize="none"
          accessibilityLabel={t.contacts.search}
          className="flex-1 text-[15px] text-ink"
          style={{ outlineStyle: 'none', minWidth: 0 } as object}
        />
      </View>

      <Pressable
        onPress={() => router.push('/contacts/new')}
        accessibilityRole="button"
        className="flex-row items-center justify-center gap-2 rounded-full bg-primary-500 py-3.5 active:opacity-80">
        <Ionicons name="person-add" size={18} color={colors.surface} />
        <Text className="text-[15px] font-semibold text-white">{t.contacts.add}</Text>
      </Pressable>

      {contacts.length === 0 ? (
        <View
          className="items-center gap-2 rounded-[20px] bg-surface px-6 py-10"
          style={cardShadow}>
          <View className="h-14 w-14 items-center justify-center rounded-full bg-primary-50">
            <Ionicons name="people-outline" size={26} color={colors.primary[500]} />
          </View>
          <Text className="text-base font-bold text-ink">{t.contacts.emptyTitle}</Text>
          <Text className="text-center text-sm leading-5 text-ink-muted">
            {t.contacts.emptyBody}
          </Text>
        </View>
      ) : favorites.length + others.length === 0 ? (
        <Text className="py-8 text-center text-sm text-ink-muted">
          {t.contacts.noResult(query.trim())}
        </Text>
      ) : (
        <>
          {section(t.contacts.favorites, favorites)}
          {section(query ? t.contacts.results : t.contacts.all, others)}
        </>
      )}
    </StackScreen>
  );
}
