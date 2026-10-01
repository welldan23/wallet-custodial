import { router, useLocalSearchParams } from 'expo-router';

import { StackScreen } from '@/components/layout/stack-screen';
import { AddressCard } from '@/components/receive/address-card';
import { NetworkChips, NetworkList } from '@/components/receive/network-picker';
import { DemoBanner } from '@/components/ui/demo-banner';
import { useSupportedNetworks } from '@/hooks/use-supported-networks';
import { useWalletAccounts } from '@/hooks/use-wallet-accounts';
import { useI18n } from '@/i18n';
import { addressForNetwork } from '@/lib/address';
import type { NetworkId } from '@/types/wallet';

/**
 * Terima Aset: pilih jaringan dulu, baru alamat tampil. Jaringan terpilih
 * disimpan di URL (`/receive?network=arbitrum`) supaya bisa ditautkan langsung.
 */
export default function ReceiveScreen() {
  const { t } = useI18n();
  const params = useLocalSearchParams<{ network?: string }>();
  const supported = useSupportedNetworks();
  const { accounts, isDemo } = useWalletAccounts();

  const selected = supported.find((item) => item.network.id === params.network) ?? null;
  const selectNetwork = (networkId: NetworkId) => router.setParams({ network: networkId });
  const pickerProps = {
    items: supported,
    selectedId: selected?.network.id ?? null,
    onSelect: selectNetwork,
  };

  return (
    <StackScreen title={t.receive.title}>
      {isDemo && <DemoBanner message={t.receive.demoWarning} />}

      {selected ? (
        <>
          <AddressCard
            network={selected.network}
            address={addressForNetwork(accounts, selected.network)}
            symbols={selected.symbols}
          />
          <NetworkChips {...pickerProps} />
        </>
      ) : (
        <NetworkList {...pickerProps} />
      )}
    </StackScreen>
  );
}
