import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { NetworkIcon } from '@/components/crypto/network-icon';
import { BottomSheet } from '@/components/ui/bottom-sheet';
import { useI18n } from '@/i18n';
import { shortenAddress } from '@/lib/address';
import { colors } from '@/theme/colors';
import type { Contact, Network } from '@/types/wallet';

type ContactPickerSheetProps = {
  visible: boolean;
  onClose: () => void;
  contacts: Contact[];
  /** Jaringan aset yang dikirim; hanya kontak bertipe sama yang tampil. */
  network: Network;
  networks: Network[];
  onSelect: (contact: Contact) => void;
};

const initials = (name: string) =>
  name
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? '')
    .join('');

/** Kontak yang alamatnya bisa dipakai di jaringan ini (EVM ↔ EVM, Solana ↔ Solana). */
export function contactsForNetwork(contacts: Contact[], network: Network, networks: Network[]) {
  return contacts
    .filter((contact) => {
      const contactNetwork = networks.find((item) => item.id === contact.networkId);
      const chainType =
        contactNetwork?.chainType ?? (contact.address.startsWith('0x') ? 'evm' : 'solana');
      return chainType === network.chainType;
    })
    .sort((a, b) => Number(b.isFavorite) - Number(a.isFavorite));
}

/** Lembar "Buku Alamat": pilih penerima tanpa mengetik alamat. */
export function ContactPickerSheet({
  visible,
  onClose,
  contacts,
  network,
  networks,
  onSelect,
}: ContactPickerSheetProps) {
  const { t } = useI18n();
  const usable = contactsForNetwork(contacts, network, networks);

  return (
    <BottomSheet visible={visible} onClose={onClose} title={t.send.addressBookTitle}>
      <Text className="mb-1 text-xs text-ink-muted">{t.send.addressBookHint(network.name)}</Text>
      <ScrollView>
        {usable.length === 0 && (
          <Text className="py-8 text-center text-sm text-ink-muted">
            {t.send.addressBookEmpty(network.name)}
          </Text>
        )}
        {usable.map((contact, index) => {
          const usualNetwork = networks.find((item) => item.id === contact.networkId);
          const otherNetwork = usualNetwork && usualNetwork.id !== network.id;
          return (
            <Pressable
              key={contact.id}
              onPress={() => {
                onSelect(contact);
                onClose();
              }}
              accessibilityRole="button"
              accessibilityLabel={`${contact.name}, ${shortenAddress(contact.address)}`}
              className={`flex-row items-center gap-3 py-3 active:opacity-70 ${
                index === usable.length - 1 ? '' : 'border-b border-line'
              }`}>
              <View className="h-10 w-10 items-center justify-center rounded-full bg-primary-50">
                <Text className="text-sm font-bold text-primary-600">{initials(contact.name)}</Text>
              </View>
              <View className="flex-1">
                <Text className="text-[15px] font-semibold text-ink">{contact.name}</Text>
                <Text className="text-xs text-ink-muted">{shortenAddress(contact.address)}</Text>
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
              {contact.isFavorite && <Ionicons name="star" size={16} color={colors.warning[500]} />}
            </Pressable>
          );
        })}
      </ScrollView>
    </BottomSheet>
  );
}
