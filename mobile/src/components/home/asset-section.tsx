import { Text, View } from 'react-native';

import { useI18n } from '@/i18n';
import type { PortfolioAsset } from '@/lib/portfolio';
import { cardShadow } from '@/theme/colors';
import type { FiatCurrency, FxRates } from '@/types/wallet';

import { AssetRow } from './asset-row';

type AssetSectionProps = {
  title: string;
  subtitle?: string;
  assets: PortfolioAsset[];
  currency: FiatCurrency;
  fxRates: FxRates;
  hidden: boolean;
};

/** Kartu putih berisi judul bagian + daftar aset. */
export function AssetSection({
  title,
  subtitle,
  assets,
  currency,
  fxRates,
  hidden,
}: AssetSectionProps) {
  const { t } = useI18n();

  return (
    <View className="rounded-3xl bg-surface px-4 pb-1 pt-4" style={cardShadow}>
      <View className="flex-row items-baseline justify-between gap-2">
        <Text className="text-base font-bold text-ink">{title}</Text>
        {subtitle && <Text className="text-xs text-ink-muted">{subtitle}</Text>}
      </View>

      {assets.length === 0 ? (
        <Text className="py-6 text-center text-sm text-ink-muted">{t.home.emptyAssets}</Text>
      ) : (
        assets.map((asset, index) => (
          <AssetRow
            key={asset.symbol}
            asset={asset}
            currency={currency}
            fxRates={fxRates}
            hidden={hidden}
            isLast={index === assets.length - 1}
          />
        ))
      )}
    </View>
  );
}
