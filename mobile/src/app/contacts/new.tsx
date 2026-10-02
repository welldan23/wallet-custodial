import Ionicons from '@expo/vector-icons/Ionicons';
import * as Clipboard from 'expo-clipboard';
import { router } from 'expo-router';
import { useState } from 'react';
import { Platform, Pressable, Switch, Text, TextInput, View } from 'react-native';

import { StackScreen } from '@/components/layout/stack-screen';
import { QrScannerModal } from '@/components/send/qr-scanner-modal';
import { useToast } from '@/components/ui/toast';
import { useContacts } from '@/hooks/use-contacts';
import { useSupportedNetworks } from '@/hooks/use-supported-networks';
import { useWalletAccounts } from '@/hooks/use-wallet-accounts';
import { useI18n } from '@/i18n';
import {
  CONTACT_NAME_MAX,
  checkContactForm,
  guessChainType,
  scopeChainType,
  type ContactAddressCheck,
  type ContactScope,
} from '@/lib/contact-form';
import { parseScannedAddress } from '@/lib/payment-uri';
import { cardShadow, colors } from '@/theme/colors';

const monoFont = Platform.select({ ios: 'Menlo', default: 'monospace' });

/** Form tambah kontak: nama, jaringan, alamat (tempel/scan QR), dan favorit. */
export default function NewContactScreen() {
  const { t } = useI18n();
  const toast = useToast();
  const { contacts, addContact } = useContacts();
  const { accounts, isDemo } = useWalletAccounts();
  const networks = useSupportedNetworks().map((item) => item.network);

  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [scope, setScope] = useState<ContactScope>('all_evm');
  const [isFavorite, setIsFavorite] = useState(false);
  const [nameTouched, setNameTouched] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [autoNote, setAutoNote] = useState<string | null>(null);
  const [scannerOpen, setScannerOpen] = useState(false);

  const check = checkContactForm(
    { name, address, scope, isFavorite },
    { networks, contacts, ownAccounts: isDemo ? undefined : accounts },
  );
  const showNameError = (nameTouched || submitted) && check.name.status !== 'valid';
  const scopeLabel = (value: ContactScope) =>
    value === 'all_evm'
      ? t.contacts.form.allEvm
      : (networks.find((network) => network.id === value)?.name ?? value);
  const scopeOptions: ContactScope[] = ['all_evm', ...networks.map((network) => network.id)];

  /** Alamat Solana di jaringan EVM (atau sebaliknya) langsung dipindah ke jaringan yang cocok. */
  const changeAddress = (value: string) => {
    setAddress(value);
    const guessed = guessChainType(value);
    if (guessed && guessed !== scopeChainType(scope, networks)) {
      const next: ContactScope = guessed === 'evm' ? 'all_evm' : 'solana';
      setScope(next);
      setAutoNote(t.contacts.form.autoNetwork(scopeLabel(next)));
    } else if (!value) {
      setAutoNote(null);
    }
  };

  const paste = async () => {
    try {
      const text = await Clipboard.getStringAsync();
      if (text) changeAddress(text.trim());
    } catch {
      toast({ variant: 'error', title: t.send.pasteFailed });
    }
  };

  const save = () => {
    setSubmitted(true);
    if (!check.contact) return;
    const contact = addContact(check.contact);
    toast({ variant: 'success', title: t.contacts.form.saved(contact.name) });
    router.back();
  };

  return (
    <StackScreen title={t.contacts.add}>
      <View className="gap-1.5 rounded-[20px] bg-surface px-4 py-3.5" style={cardShadow}>
        <Text className="text-[13px] font-semibold text-ink-muted">
          {t.contacts.form.nameLabel}
        </Text>
        <TextInput
          value={name}
          onChangeText={setName}
          onBlur={() => setNameTouched(true)}
          placeholder={t.contacts.form.namePlaceholder}
          placeholderTextColor={colors.ink.faint}
          maxLength={CONTACT_NAME_MAX + 10}
          accessibilityLabel={t.contacts.form.nameLabel}
          className={`rounded-2xl border bg-subtle px-3 py-3 text-[15px] text-ink ${
            showNameError ? 'border-danger-500' : 'border-line'
          }`}
          style={{ outlineStyle: 'none', minWidth: 0 } as object}
        />
        <View className="flex-row justify-between gap-2">
          <Text className="flex-1 text-xs text-danger-600" accessibilityRole="alert">
            {showNameError
              ? check.name.status === 'too_long'
                ? t.contacts.form.nameTooLong(CONTACT_NAME_MAX)
                : t.contacts.form.nameEmpty
              : ''}
          </Text>
          <Text
            className={`text-xs ${name.trim().length > CONTACT_NAME_MAX ? 'text-danger-600' : 'text-ink-faint'}`}>
            {name.trim().length}/{CONTACT_NAME_MAX}
          </Text>
        </View>
      </View>

      <View className="gap-2.5 rounded-[20px] bg-surface px-4 py-3.5" style={cardShadow}>
        <Text className="text-[13px] font-semibold text-ink-muted">
          {t.contacts.form.networkLabel}
        </Text>
        <View className="flex-row flex-wrap gap-2">
          {scopeOptions.map((option) => {
            const active = option === scope;
            return (
              <Pressable
                key={option}
                onPress={() => {
                  setScope(option);
                  setAutoNote(null);
                }}
                accessibilityRole="radio"
                aria-checked={active}
                className={`rounded-full border px-3.5 py-2 active:opacity-70 ${
                  active ? 'border-primary-500 bg-primary-50' : 'border-line bg-surface'
                }`}>
                <Text
                  className={`text-[13px] font-semibold ${active ? 'text-primary-600' : 'text-ink-soft'}`}>
                  {scopeLabel(option)}
                </Text>
              </Pressable>
            );
          })}
        </View>
        <Text className="text-xs leading-[18px] text-ink-muted">{t.contacts.form.networkHint}</Text>
      </View>

      <View className="gap-2 rounded-[20px] bg-surface px-4 py-3.5" style={cardShadow}>
        <Text className="text-[13px] font-semibold text-ink-muted">
          {t.contacts.form.addressLabel}
        </Text>
        <View
          className={`flex-row items-center gap-2 rounded-2xl border bg-subtle px-3 py-2 ${addressBorder(
            check.address,
            submitted,
          )}`}>
          <TextInput
            value={address}
            onChangeText={changeAddress}
            placeholder={
              scopeChainType(scope, networks) === 'evm' ? '0x…' : t.send.solanaPlaceholder
            }
            placeholderTextColor={colors.ink.faint}
            autoCapitalize="none"
            autoCorrect={false}
            spellCheck={false}
            multiline
            accessibilityLabel={t.contacts.form.addressLabel}
            className="min-h-[44px] flex-1 py-1.5 text-[15px] text-ink"
            style={[{ fontFamily: monoFont, minWidth: 0 }, { outlineStyle: 'none' } as object]}
          />
          {address ? (
            <Pressable
              onPress={() => changeAddress('')}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={t.send.clearAddress}>
              <Ionicons name="close-circle" size={20} color={colors.ink.faint} />
            </Pressable>
          ) : (
            <Pressable
              onPress={paste}
              accessibilityRole="button"
              accessibilityLabel={t.send.paste}
              className="rounded-full bg-primary-50 px-3 py-1.5 active:opacity-70">
              <Text className="text-xs font-semibold text-primary-500">{t.send.paste}</Text>
            </Pressable>
          )}
        </View>
        {autoNote && check.address.status !== 'empty' && (
          <Text className="text-xs text-primary-600">{autoNote}</Text>
        )}
        <AddressFeedback
          check={check.address}
          networkName={scopeLabel(scope)}
          showEmpty={submitted}
        />
        <Pressable
          onPress={() => setScannerOpen(true)}
          accessibilityRole="button"
          accessibilityLabel={t.send.scanQr}
          className="mt-1 flex-row items-center justify-center gap-1.5 rounded-full border border-line bg-surface py-2.5 active:opacity-70">
          <Ionicons name="scan-outline" size={16} color={colors.primary[500]} />
          <Text className="text-[13px] font-semibold text-primary-500">{t.send.scanQr}</Text>
        </Pressable>
      </View>

      <View
        className="flex-row items-center gap-3 rounded-[20px] bg-surface px-4 py-3.5"
        style={cardShadow}>
        <Ionicons
          name={isFavorite ? 'star' : 'star-outline'}
          size={20}
          color={isFavorite ? colors.warning[500] : colors.ink.faint}
        />
        <View className="flex-1">
          <Text className="text-[15px] font-semibold text-ink">
            {t.contacts.form.favoriteLabel}
          </Text>
          <Text className="text-xs text-ink-muted">{t.contacts.form.favoriteHint}</Text>
        </View>
        <Switch
          value={isFavorite}
          onValueChange={setIsFavorite}
          accessibilityLabel={t.contacts.form.favoriteLabel}
          trackColor={{ true: colors.primary[500], false: colors.line }}
          thumbColor={colors.surface}
        />
      </View>

      <Pressable
        onPress={save}
        accessibilityRole="button"
        accessibilityState={{ disabled: submitted && !check.contact }}
        className={`items-center rounded-full py-4 active:opacity-80 ${
          submitted && !check.contact ? 'bg-primary-500/50' : 'bg-primary-500'
        }`}>
        <Text className="text-base font-semibold text-white">{t.contacts.form.save}</Text>
      </Pressable>

      <QrScannerModal
        visible={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onScanned={(data) => changeAddress(parseScannedAddress(data).address)}
      />
    </StackScreen>
  );
}

function addressBorder(check: ContactAddressCheck, submitted: boolean): string {
  if (check.status === 'valid') return 'border-success-500';
  if (check.status === 'empty') return submitted ? 'border-danger-500' : 'border-line';
  return 'border-danger-500';
}

type AddressFeedbackProps = {
  check: ContactAddressCheck;
  networkName: string;
  /** Tampilkan "wajib diisi" setelah tombol simpan ditekan. */
  showEmpty: boolean;
};

function AddressFeedback({ check, networkName, showEmpty }: AddressFeedbackProps) {
  const { t } = useI18n();
  const form = t.contacts.form;
  if (check.status === 'empty' && !showEmpty) return null;

  let tone: 'danger' | 'warning' | 'success' = 'danger';
  let message: string;
  if (check.status === 'empty') message = form.addressEmpty;
  else if (check.status === 'duplicate') message = form.duplicate(check.existingName);
  else if (check.status === 'invalid') {
    message =
      check.reason === 'solana_on_evm'
        ? form.solanaOnEvm
        : check.reason === 'evm_on_solana'
          ? form.evmOnSolana
          : t.send.invalidReason[check.reason](networkName);
  } else if (check.warning === 'own_address') {
    tone = 'warning';
    message = form.ownAddress;
  } else {
    tone = 'success';
    message = form.validAddress(networkName);
  }

  const icon =
    tone === 'danger' ? 'close-circle' : tone === 'warning' ? 'warning' : 'checkmark-circle';
  const color =
    tone === 'danger'
      ? colors.danger[600]
      : tone === 'warning'
        ? colors.warning[600]
        : colors.success[600];

  return (
    <View
      className="flex-row items-start gap-1.5"
      accessibilityRole={tone === 'success' ? undefined : 'alert'}
      accessibilityLiveRegion="polite">
      <Ionicons name={icon} size={16} color={color} />
      <Text className="flex-1 text-xs leading-[18px]" style={{ color }}>
        {message}
      </Text>
    </View>
  );
}
