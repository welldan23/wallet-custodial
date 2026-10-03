import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';

import { NetworkIcon } from '@/components/crypto/network-icon';
import { BottomSheet } from '@/components/ui/bottom-sheet';
import { useI18n } from '@/i18n';
import { shortenAddress } from '@/lib/address';
import {
  avatarColorIndex,
  chainTypeOfAddress,
  contactInitials,
  filterContacts,
  groupContacts,
} from '@/lib/contacts';
import { useThemeColors } from '@/hooks/use-theme';
import type { Contact, Network } from '@/types/wallet';

type ContactPickerSheetProps = {
  visible: boolean;
  onClose: () => void;
  contacts: Contact[];
  /** Jaringan aset yang dikirim; hanya kontak bertipe sama yang tampil. */
  network: Network;
  networks: Network[];
  /** Alamat penerima saat ini, untuk menandai kontak yang sedang dipilih. */
  selectedAddress?: string;
  onSelect: (contact: Contact) => void;
};

const monoFont = Platform.select({ ios: 'Menlo', default: 'monospace' });
const AVATARS = [
  'bg-primary-500',
  'bg-teal-500',
  'bg-success-500',
  'bg-warning-500',
  'bg-ink-soft',
];

/** Kontak yang alamatnya bisa dipakai di jaringan ini (EVM ↔ EVM, Solana ↔ Solana). */
export function contactsForNetwork(contacts: Contact[], network: Network, networks: Network[]) {
  return contacts.filter((contact) => {
    const contactNetwork = networks.find((item) => item.id === contact.networkId);
    const chainType = contactNetwork?.chainType ?? chainTypeOfAddress(contact.address);
    return chainType === network.chainType;
  });
}

/** Lembar "Buku Alamat": cari dan pilih penerima tanpa mengetik alamat. */
export function ContactPickerSheet({
  visible,
  onClose,
  contacts,
  network,
  networks,
  selectedAddress,
  onSelect,
}: ContactPickerSheetProps) {
  const colors = useThemeColors();
  const { t } = useI18n();
  const [query, setQuery] = useState('');
  const usable = contactsForNetwork(contacts, network, networks);
  const { favorites, others } = groupContacts(filterContacts(usable, query));
  // Kontak tipe lain (Solana saat kirim di EVM, atau sebaliknya) tetap tampil tapi tidak bisa dipilih.
  const otherChain = groupContacts(
    filterContacts(
      contacts.filter((contact) => !usable.includes(contact)),
      query,
    ),
  );
  const unusable = [...otherChain.favorites, ...otherChain.others];

  const close = () => {
    setQuery('');
    onClose();
  };
  const goTo = (pathname: '/contacts' | '/contacts/new') => {
    close();
    router.push(pathname);
  };

  const disabledRow = (contact: Contact, isLast: boolean) => (
    <View
      key={contact.id}
      accessible
      accessibilityLabel={`${contact.name}, ${t.send.contactNetwork.wrongChainHint(network.name)}`}
      className={`flex-row items-center gap-3 py-3 opacity-50 ${isLast ? '' : 'border-b border-line'}`}>
      <View className="h-10 w-10 items-center justify-center rounded-full bg-ink-faint">
        <Text className="text-sm font-bold text-white">{contactInitials(contact.name)}</Text>
      </View>
      <View className="flex-1">
        <Text className="text-[15px] font-semibold text-ink" numberOfLines={1}>
          {contact.name}
        </Text>
        <Text className="text-xs text-ink-muted" style={{ fontFamily: monoFont }}>
          {shortenAddress(contact.address)}
        </Text>
        <Text className="mt-1 text-[11px] text-ink-muted">
          {t.send.contactNetwork.wrongChainHint(network.name)}
        </Text>
      </View>
      <Ionicons name="ban-outline" size={18} color={colors.ink.faint} />
    </View>
  );

  const row = (contact: Contact, isLast: boolean) => {
    const usualNetwork = networks.find((item) => item.id === contact.networkId);
    const otherNetwork = usualNetwork && usualNetwork.id !== network.id;
    const selected =
      !!selectedAddress && selectedAddress.toLowerCase() === contact.address.toLowerCase();
    return (
      <Pressable
        key={contact.id}
        onPress={() => {
          onSelect(contact);
          close();
        }}
        accessibilityRole="button"
        aria-selected={selected}
        accessibilityLabel={[
          contact.name,
          contact.isFavorite ? t.contacts.favorite : null,
          shortenAddress(contact.address),
          usualNetwork
            ? otherNetwork
              ? t.send.contactUsualNetworkOther(usualNetwork.name)
              : t.send.contactUsualNetwork(usualNetwork.name)
            : null,
        ]
          .filter(Boolean)
          .join(', ')}
        className={`flex-row items-center gap-3 py-3 active:opacity-70 ${
          isLast ? '' : 'border-b border-line'
        }`}>
        <View
          className={`h-10 w-10 items-center justify-center rounded-full ${AVATARS[avatarColorIndex(contact.name, AVATARS.length)]}`}>
          <Text className="text-sm font-bold text-white">{contactInitials(contact.name)}</Text>
        </View>
        <View className="flex-1">
          <View className="flex-row items-center gap-1">
            <Text className="shrink text-[15px] font-semibold text-ink" numberOfLines={1}>
              {contact.name}
            </Text>
            {contact.isFavorite && <Ionicons name="star" size={13} color={colors.warning[500]} />}
          </View>
          <Text className="text-xs text-ink-muted" style={{ fontFamily: monoFont }}>
            {shortenAddress(contact.address)}
          </Text>
          {usualNetwork && (
            <View className="mt-1 flex-row items-center gap-1">
              <NetworkIcon networkId={usualNetwork.id} size={12} />
              <Text
                className={`text-[11px] ${otherNetwork ? 'font-semibold text-warning-600' : 'text-ink-muted'}`}>
                {otherNetwork
                  ? t.send.contactUsualNetworkOther(usualNetwork.name)
                  : t.send.contactUsualNetwork(usualNetwork.name)}
              </Text>
            </View>
          )}
        </View>
        {selected && <Ionicons name="checkmark-circle" size={20} color={colors.primary[500]} />}
      </Pressable>
    );
  };

  const section = (title: string, items: Contact[]) =>
    items.length > 0 && (
      <View>
        <Text
          className="pt-2 text-[12px] font-semibold uppercase text-ink-faint"
          accessibilityRole="header">
          {title}
        </Text>
        {items.map((contact, index) => row(contact, index === items.length - 1))}
      </View>
    );

  return (
    <BottomSheet visible={visible} onClose={close} title={t.send.addressBookTitle}>
      <Text className="mb-2 text-xs text-ink-muted">{t.send.addressBookHint(network.name)}</Text>

      {contacts.length > 0 && (
        <View className="mb-1 flex-row items-center gap-2 rounded-full bg-subtle px-4 py-2.5">
          <Ionicons name="search" size={16} color={colors.ink.faint} />
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
      )}

      <ScrollView keyboardShouldPersistTaps="handled">
        {usable.length === 0 ? (
          <Text className="py-8 text-center text-sm text-ink-muted">
            {t.send.addressBookEmpty(network.name)}
          </Text>
        ) : favorites.length + others.length + unusable.length === 0 ? (
          <Text className="py-8 text-center text-sm text-ink-muted">
            {t.contacts.noResult(query.trim())}
          </Text>
        ) : (
          <>
            {section(t.contacts.favorites, favorites)}
            {section(query ? t.contacts.results : t.contacts.all, others)}
          </>
        )}
        {unusable.length > 0 && (
          <View>
            <Text
              className="pt-2 text-[12px] font-semibold uppercase text-ink-faint"
              accessibilityRole="header">
              {t.send.contactNetwork.wrongChain}
            </Text>
            {unusable.map((contact, index) => disabledRow(contact, index === unusable.length - 1))}
          </View>
        )}
      </ScrollView>

      <View className="mt-3 flex-row gap-2.5">
        <Pressable
          onPress={() => goTo('/contacts/new')}
          accessibilityRole="button"
          className="flex-1 flex-row items-center justify-center gap-1.5 rounded-full bg-primary-500 py-3 active:opacity-80">
          <Ionicons name="person-add" size={16} color={colors.white} />
          <Text className="text-[13px] font-semibold text-white">{t.contacts.add}</Text>
        </Pressable>
        <Pressable
          onPress={() => goTo('/contacts')}
          accessibilityRole="button"
          className="flex-1 flex-row items-center justify-center gap-1.5 rounded-full border border-line bg-surface py-3 active:opacity-70">
          <Ionicons name="book-outline" size={16} color={colors.primary[500]} />
          <Text className="text-[13px] font-semibold text-primary-500">
            {t.send.manageContacts}
          </Text>
        </Pressable>
      </View>
    </BottomSheet>
  );
}
