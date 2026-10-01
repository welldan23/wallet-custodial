import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Text } from 'react-native';

import { StackScreen } from '@/components/layout/stack-screen';
import { AssetPickerSheet } from '@/components/send/asset-picker-sheet';
import { AssetSelector } from '@/components/send/asset-selector';
import { useBalanceVisibility } from '@/hooks/use-balance-visibility';
import { useSendableAssets } from '@/hooks/use-sendable-assets';
import { useI18n } from '@/i18n';
import type { FiatCurrency } from '@/types/wallet';

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
  const [pickerOpen, setPickerOpen] = useState(false);

  const selected = assets.find((asset) => asset.tokenId === params.token) ?? assets[0] ?? null;

  return (
    <StackScreen title={t.send.title}>
      {selected ? (
        <AssetSelector
          asset={selected}
          onPress={() => setPickerOpen(true)}
          currency={DISPLAY_CURRENCY}
          fxRates={fxRates}
          hidden={hidden}
        />
      ) : (
        <Text className="py-10 text-center text-sm text-ink-muted">{t.send.noAssets}</Text>
      )}

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
