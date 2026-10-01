import { Ionicons } from '@expo/vector-icons';
import { Pressable, Text, View } from 'react-native';

import { useI18n } from '@/i18n';
import type { PortfolioAsset } from '@/lib/portfolio';
import { cardShadow, colors } from '@/theme/colors';
import type { FiatCurrency, FxRates } from '@/types/wallet';

import { AssetRow } from './asset-row';

type AssetSectionProps = {
  title: string;
  subtitle?: string;
  assets: PortfolioAsset[];
  currency: FiatCurrency;
  fxRates: FxRates;
  hidden: boolean;
  /** Pesan saat bagian ini belum punya aset. */
  emptyText: string;
  /** Kalau diisi, muncul tautan "Lihat Semua" di kanan judul. */
  onSeeAll?: () => void;
};

/** Kartu putih berisi judul bagian + daftar aset. */
export function AssetSection({
  title,
  subtitle,
  assets,
  currency,
  fxRates,
  hidden,
  emptyText,
  onSeeAll,
}: AssetSectionProps) {
  const { t } = useI18n();

  return (
    <View className="rounded-[20px] bg-surface px-4 pb-1 pt-4" style={cardShadow}>
      <View className="flex-row items-center justify-between gap-2">
        <View className="flex-1">
          <Text className="text-lg font-bold text-ink">{title}</Text>
          {subtitle && <Text className="text-xs text-ink-muted">{subtitle}</Text>}
        </View>
        {onSeeAll && (
          <Pressable
            onPress={onSeeAll}
            hitSlop={8}
            accessibilityRole="link"
            className="flex-row items-center gap-0.5 active:opacity-70">
            <Text className="text-[13px] font-semibold text-primary-500">{t.common.seeAll}</Text>
            <Ionicons name="chevron-forward" size={14} color={colors.primary[500]} />
          </Pressable>
        )}
      </View>

      {assets.length === 0 ? (
        <Text className="pb-5 pt-3 text-sm leading-5 text-ink-muted">{emptyText}</Text>
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
