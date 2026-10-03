import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, Text } from 'react-native';

import { StackScreen } from '@/components/layout/stack-screen';
import { AmountInput } from '@/components/send/amount-input';
import { AssetPickerSheet } from '@/components/send/asset-picker-sheet';
import { AssetSelector } from '@/components/send/asset-selector';
import { ContactPickerSheet } from '@/components/send/contact-picker-sheet';
import { QrScannerModal } from '@/components/send/qr-scanner-modal';
import { ContactNetworkWarning } from '@/components/send/contact-network-warning';
import { KnownRecipientNote, LookalikeWarning } from '@/components/send/lookalike-warning';
import { RecipientInput } from '@/components/send/recipient-input';
import { useToast } from '@/components/ui/toast';
import { useBalanceVisibility } from '@/hooks/use-balance-visibility';
import { useContacts } from '@/hooks/use-contacts';
import { useKnownAddresses } from '@/hooks/use-known-addresses';
import { useNetworkFee } from '@/hooks/use-network-fee';
import { useSupportedNetworks } from '@/hooks/use-supported-networks';
import { useSendableAssets } from '@/hooks/use-sendable-assets';
import { useWalletAccounts } from '@/hooks/use-wallet-accounts';
import { useDisplayCurrency } from '@/hooks/use-settings';
import { useThemeColors } from '@/hooks/use-theme';
import { useI18n } from '@/i18n';
import { validateRecipient } from '@/lib/address-validation';
import { checkAmount, normalizeAmountInput } from '@/lib/amount';
import { contactNetworkStatus, findContactByAddress } from '@/lib/contacts';
import { recognizeRecipient } from '@/lib/lookalike';
import { parseScannedAddress } from '@/lib/payment-uri';
import type { Contact } from '@/types/wallet';

/**
 * Kirim Aset. Aset (koin + jaringan) terpilih disimpan di URL
 * (`/send?token=usdc-arbitrum`); default-nya saldo terbesar.
 */
export default function SendScreen() {
  const colors = useThemeColors();
  const displayCurrency = useDisplayCurrency();
  const { t } = useI18n();
  const params = useLocalSearchParams<{ token?: string }>();
  const { assets, fxRates } = useSendableAssets();
  const { hidden } = useBalanceVisibility();
  const { accounts } = useWalletAccounts();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [recipient, setRecipient] = useState('');
  const [amount, setAmount] = useState('');
  const [pickedContact, setPickedContact] = useState<Contact | null>(null);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [contactsOpen, setContactsOpen] = useState(false);
  const { contacts } = useContacts();
  const networks = useSupportedNetworks().map((item) => item.network);
  const toast = useToast();
  const knownAddresses = useKnownAddresses();

  const selected = assets.find((asset) => asset.tokenId === params.token) ?? assets[0] ?? null;
  const editRecipient = (value: string) => {
    setRecipient(value);
    setPickedContact(null);
  };

  const handleScanned = (data: string) => {
    const scanned = parseScannedAddress(data);
    editRecipient(scanned.address);
    if (
      selected &&
      scanned.chainId &&
      selected.network.chainType === 'evm' &&
      scanned.chainId !== selected.network.chainId
    ) {
      const qrNetwork = networks.find((network) => network.chainId === scanned.chainId);
      toast({
        variant: 'error',
        title: t.send.qrNetworkMismatchTitle,
        message: t.send.qrNetworkMismatch(
          qrNetwork?.name ?? `chain ${scanned.chainId}`,
          selected.network.name,
        ),
      });
    }
  };

  const pickContact = (contact: Contact) => {
    setRecipient(contact.address);
    setPickedContact(contact);
  };

  const contactName = pickedContact?.name ?? null;
  const recipientCheck = selected
    ? validateRecipient(recipient, selected.network, accounts)
    : ({ status: 'empty' } as const);

  // Kontak yang dipilih, atau kontak yang alamatnya diketik/ditempel persis.
  const matchedContact =
    pickedContact ??
    (recipientCheck.status === 'valid'
      ? findContactByAddress(contacts, recipientCheck.address)
      : undefined);
  const contactStatus =
    selected && matchedContact
      ? contactNetworkStatus(matchedContact, selected.network, networks)
      : ({ kind: 'ok' } as const);
  // Aset yang sama di jaringan kontak, untuk tombol "Kirim lewat … saja".
  const assetOnUsualNetwork =
    selected && contactStatus.kind === 'other_network'
      ? assets.find(
          (asset) =>
            asset.symbol === selected.symbol && asset.network.id === contactStatus.usual.id,
        )
      : undefined;

  const recognition =
    recipientCheck.status === 'valid'
      ? recognizeRecipient(recipientCheck.address, knownAddresses)
      : ({ kind: 'unknown' } as const);

  const fee = useNetworkFee(selected?.network ?? null);
  const isNative = selected ? selected.symbol === selected.network.nativeSymbol : false;
  // Kirim koin gas: sisakan biaya jaringan supaya transaksi tidak gagal.
  const maxAmount =
    selected && fee
      ? Math.max(0, selected.amount - (isNative ? fee.feeUsd / (fee.nativeUsdPrice || 1) : 0))
      : 0;
  const amountCheck = selected
    ? checkAmount(amount, maxAmount, selected.decimals)
    : ({ status: 'empty' } as const);
  const canContinue = recipientCheck.status === 'valid' && amountCheck.status === 'valid';

  const goToConfirm = () => {
    if (!selected || recipientCheck.status !== 'valid' || amountCheck.status !== 'valid') return;
    router.push({
      pathname: '/send/confirm',
      params: {
        token: selected.tokenId,
        to: recipientCheck.address,
        amount: normalizeAmountInput(amount),
        ...(contactName ? { contact: contactName } : {}),
      },
    });
  };

  return (
    <StackScreen title={t.send.title}>
      {selected ? (
        <>
          <AssetSelector
            asset={selected}
            onPress={() => setPickerOpen(true)}
            currency={displayCurrency}
            fxRates={fxRates}
            hidden={hidden}
          />
          <RecipientInput
            value={recipient}
            onChange={editRecipient}
            network={selected.network}
            check={recipientCheck}
            contactName={contactName}
            onOpenScanner={() => setScannerOpen(true)}
            onOpenContacts={() => setContactsOpen(true)}
          />
          {matchedContact && contactStatus.kind === 'other_network' && (
            <ContactNetworkWarning
              contactName={matchedContact.name}
              usual={contactStatus.usual}
              current={selected.network}
              onSwitch={
                assetOnUsualNetwork
                  ? () => router.setParams({ token: assetOnUsualNetwork.tokenId })
                  : undefined
              }
            />
          )}
          {recipientCheck.status === 'valid' && recognition.kind === 'lookalike' && (
            <LookalikeWarning recipient={recipientCheck.address} match={recognition.match} />
          )}
          {recognition.kind === 'exact' && !contactName && (
            <KnownRecipientNote label={recognition.known.label} />
          )}
          {recipientCheck.status === 'valid' &&
            recognition.kind === 'unknown' &&
            !recipientCheck.warning && (
              <Pressable
                onPress={() =>
                  router.push({
                    pathname: '/contacts/new',
                    params: { address: recipientCheck.address },
                  })
                }
                accessibilityRole="button"
                className="flex-row items-center gap-1.5 self-start px-1 active:opacity-70">
                <Ionicons name="person-add-outline" size={15} color={colors.primary[500]} />
                <Text className="text-xs font-semibold text-primary-500">
                  {t.send.saveToContacts}
                </Text>
              </Pressable>
            )}
          {fee && (
            <AmountInput
              value={amount}
              onChange={setAmount}
              asset={selected}
              check={amountCheck}
              maxAmount={maxAmount}
              usdPrice={fee.priceOf(selected.symbol)}
              currency={displayCurrency}
              fxRates={fxRates}
            />
          )}
          <Pressable
            onPress={goToConfirm}
            disabled={!canContinue}
            accessibilityRole="button"
            accessibilityState={{ disabled: !canContinue }}
            className={`items-center rounded-full py-4 ${
              canContinue ? 'bg-primary-500 active:opacity-80' : 'bg-line'
            }`}>
            <Text
              className={`text-base font-semibold ${canContinue ? 'text-white' : 'text-ink-faint'}`}>
              {t.send.continue}
            </Text>
          </Pressable>
          <ContactPickerSheet
            visible={contactsOpen}
            onClose={() => setContactsOpen(false)}
            contacts={contacts}
            network={selected.network}
            networks={networks}
            selectedAddress={pickedContact?.address}
            onSelect={pickContact}
          />
        </>
      ) : (
        <Text className="py-10 text-center text-sm text-ink-muted">{t.send.noAssets}</Text>
      )}

      <QrScannerModal
        visible={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onScanned={handleScanned}
      />

      <AssetPickerSheet
        visible={pickerOpen}
        onClose={() => setPickerOpen(false)}
        assets={assets}
        selectedTokenId={selected?.tokenId ?? null}
        onSelect={(tokenId) => router.setParams({ token: tokenId })}
        currency={displayCurrency}
        fxRates={fxRates}
        hidden={hidden}
      />
    </StackScreen>
  );
}
