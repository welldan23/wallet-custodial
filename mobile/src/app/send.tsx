import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Text } from 'react-native';

import { StackScreen } from '@/components/layout/stack-screen';
import { AssetPickerSheet } from '@/components/send/asset-picker-sheet';
import { AssetSelector } from '@/components/send/asset-selector';
import { ContactPickerSheet } from '@/components/send/contact-picker-sheet';
import { QrScannerModal } from '@/components/send/qr-scanner-modal';
import { RecipientInput } from '@/components/send/recipient-input';
import { useToast } from '@/components/ui/toast';
import { useBalanceVisibility } from '@/hooks/use-balance-visibility';
import { useContacts } from '@/hooks/use-contacts';
import { useSupportedNetworks } from '@/hooks/use-supported-networks';
import { useSendableAssets } from '@/hooks/use-sendable-assets';
import { useWalletAccounts } from '@/hooks/use-wallet-accounts';
import { useI18n } from '@/i18n';
import { validateRecipient } from '@/lib/address-validation';
import { parseScannedAddress } from '@/lib/payment-uri';
import type { Contact, FiatCurrency } from '@/types/wallet';

/** Mata uang pendamping USD. Nanti diambil dari Pengaturan. */
const DISPLAY_CURRENCY: FiatCurrency = 'IDR';

/**
 * Kirim Aset. Aset (koin + jaringan) terpilih disimpan di URL
 * (`/send?token=usdc-arbitrum`); default-nya saldo terbesar.
 */
export default function SendScreen() {
  const { t } = useI18n();
  const params = useLocalSearchParams<{ token?: string }>();
  const { assets, fxRates } = useSendableAssets();
  const { hidden } = useBalanceVisibility();
  const { accounts } = useWalletAccounts();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [recipient, setRecipient] = useState('');
  const [contactName, setContactName] = useState<string | null>(null);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [contactsOpen, setContactsOpen] = useState(false);
  const { contacts } = useContacts();
  const networks = useSupportedNetworks().map((item) => item.network);
  const toast = useToast();

  const selected = assets.find((asset) => asset.tokenId === params.token) ?? assets[0] ?? null;
  const editRecipient = (value: string) => {
    setRecipient(value);
    setContactName(null);
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
    setContactName(contact.name);
  };

  const recipientCheck = selected
    ? validateRecipient(recipient, selected.network, accounts)
    : ({ status: 'empty' } as const);

  return (
    <StackScreen title={t.send.title}>
      {selected ? (
        <>
          <AssetSelector
            asset={selected}
            onPress={() => setPickerOpen(true)}
            currency={DISPLAY_CURRENCY}
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
          <ContactPickerSheet
            visible={contactsOpen}
            onClose={() => setContactsOpen(false)}
            contacts={contacts}
            network={selected.network}
            networks={networks}
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
        currency={DISPLAY_CURRENCY}
        fxRates={fxRates}
        hidden={hidden}
      />
    </StackScreen>
  );
}
