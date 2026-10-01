import Ionicons from '@expo/vector-icons/Ionicons';
import { useLocalSearchParams } from 'expo-router';
import { Text, View } from 'react-native';

import { TransactionDetail } from '@/components/history/transaction-detail';
import { StackScreen } from '@/components/layout/stack-screen';
import { useBalanceVisibility } from '@/hooks/use-balance-visibility';
import { useHistory } from '@/hooks/use-history';
import { useSupportedNetworks } from '@/hooks/use-supported-networks';
import { useWalletAccounts } from '@/hooks/use-wallet-accounts';
import { useI18n } from '@/i18n';
import { MOCK_FX_RATES } from '@/mocks/wallet';
import { cardShadow, colors } from '@/theme/colors';
import type { FiatCurrency, NetworkId } from '@/types/wallet';

/** Mata uang pendamping USD. Nanti diambil dari Pengaturan. */
const DISPLAY_CURRENCY: FiatCurrency = 'IDR';

/** Halaman detail satu transaksi dari Riwayat. */
export default function TransactionDetailScreen() {
  const { t } = useI18n();
  const { id } = useLocalSearchParams<{ id: string }>();
  const history = useHistory();
  const networks = useSupportedNetworks();
  const { hidden } = useBalanceVisibility();
  const { isDemo } = useWalletAccounts();
  const item = history.find((entry) => entry.id === id);
  const networkOf = (networkId: NetworkId) =>
    networks.find((entry) => entry.network.id === networkId)?.network;

  return (
    <StackScreen title={t.history.detailTitle}>
      {item ? (
        <TransactionDetail
          item={item}
          networkOf={networkOf}
          currency={DISPLAY_CURRENCY}
          fxRates={MOCK_FX_RATES}
          hidden={hidden}
          isDemo={isDemo}
        />
      ) : (
        <View
          className="items-center gap-3 rounded-[20px] bg-surface px-6 py-10"
          style={cardShadow}>
          <Ionicons name="help-circle" size={36} color={colors.ink.muted} />
          <Text className="text-center text-sm leading-5 text-ink-soft">{t.history.notFound}</Text>
        </View>
      )}
    </StackScreen>
  );
}
