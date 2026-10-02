import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { ContactForm } from '@/components/contacts/contact-form';
import { StackScreen } from '@/components/layout/stack-screen';
import { BottomSheet } from '@/components/ui/bottom-sheet';
import { useToast } from '@/components/ui/toast';
import { useContacts } from '@/hooks/use-contacts';
import { useI18n } from '@/i18n';
import { shortenAddress } from '@/lib/address';
import { contactToFormInput } from '@/lib/contact-form';
import { cardShadow, colors } from '@/theme/colors';

/** Ubah kontak, atau hapus setelah konfirmasi. */
export default function EditContactScreen() {
  const { t } = useI18n();
  const toast = useToast();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { contacts, updateContact, removeContact } = useContacts();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const contact = contacts.find((item) => item.id === id);
  const edit = t.contacts.edit;

  if (!contact) {
    return (
      <StackScreen title={edit.title}>
        <View
          className="items-center gap-2 rounded-[20px] bg-surface px-6 py-10"
          style={cardShadow}>
          <Ionicons name="person-remove-outline" size={28} color={colors.ink.faint} />
          <Text className="text-base font-bold text-ink">{edit.notFoundTitle}</Text>
          <Text className="text-center text-sm text-ink-muted">{edit.notFoundBody}</Text>
          <Pressable
            onPress={() => router.dismissTo('/contacts')}
            accessibilityRole="button"
            className="mt-2 rounded-full bg-primary-50 px-4 py-2.5 active:opacity-70">
            <Text className="text-sm font-semibold text-primary-600">{edit.backToList}</Text>
          </Pressable>
        </View>
      </StackScreen>
    );
  }

  const remove = () => {
    setConfirmOpen(false);
    removeContact(contact.id);
    toast({ variant: 'success', title: edit.deleted(contact.name) });
    router.back();
  };

  return (
    <StackScreen title={edit.title}>
      <ContactForm
        // Form diisi ulang kalau pindah ke kontak lain.
        key={contact.id}
        initial={contactToFormInput(contact)}
        excludeId={contact.id}
        submitLabel={edit.save}
        onSubmit={(changes) => {
          updateContact(contact.id, changes);
          toast({ variant: 'success', title: edit.saved });
          router.back();
        }}
        footer={
          <Pressable
            onPress={() => setConfirmOpen(true)}
            accessibilityRole="button"
            className="flex-row items-center justify-center gap-2 rounded-full border border-danger-500 bg-surface py-3.5 active:opacity-70">
            <Ionicons name="trash-outline" size={18} color={colors.danger[600]} />
            <Text className="text-[15px] font-semibold text-danger-600">{edit.delete}</Text>
          </Pressable>
        }
      />

      <BottomSheet
        visible={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title={edit.confirmTitle}>
        <View className="gap-4 pb-2 pt-1">
          <View className="flex-row items-center gap-3 rounded-2xl bg-danger-50 p-3.5">
            <Ionicons name="trash-outline" size={22} color={colors.danger[600]} />
            <View className="flex-1 gap-0.5">
              <Text className="text-[15px] font-semibold text-ink" numberOfLines={1}>
                {contact.name}
              </Text>
              <Text className="text-xs text-ink-muted">{shortenAddress(contact.address)}</Text>
            </View>
          </View>
          <Text className="text-sm leading-5 text-ink-soft">{edit.confirmBody(contact.name)}</Text>
          <View className="flex-row gap-2.5">
            <Pressable
              onPress={() => setConfirmOpen(false)}
              accessibilityRole="button"
              className="flex-1 items-center rounded-full bg-subtle py-3.5 active:opacity-70">
              <Text className="text-[15px] font-semibold text-ink-soft">{edit.cancel}</Text>
            </Pressable>
            <Pressable
              onPress={remove}
              accessibilityRole="button"
              className="flex-1 items-center rounded-full bg-danger-500 py-3.5 active:opacity-80">
              <Text className="text-[15px] font-semibold text-white">{edit.confirmDelete}</Text>
            </Pressable>
          </View>
        </View>
      </BottomSheet>
    </StackScreen>
  );
}
