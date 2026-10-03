import Ionicons from '@expo/vector-icons/Ionicons';
import Constants from 'expo-constants';
import { router } from 'expo-router';
import { useState } from 'react';
import { Platform, Switch, Text, View } from 'react-native';

import { TabScreen } from '@/components/layout/tab-screen';
import { OptionSheet } from '@/components/settings/option-sheet';
import { SettingsGroup, SettingsRow } from '@/components/settings/settings-row';
import { useToast } from '@/components/ui/toast';
import { useContacts } from '@/hooks/use-contacts';
import { useSettings } from '@/hooks/use-settings';
import { useWalletAccounts } from '@/hooks/use-wallet-accounts';
import { useFormat } from '@/hooks/use-format';
import { useThemeColors } from '@/hooks/use-theme';
import { useI18n } from '@/i18n';
import { shortenAddress } from '@/lib/address';
import { MOCK_FX_RATES } from '@/mocks/wallet';
import { cardShadow } from '@/theme/colors';

const monoFont = Platform.select({ ios: 'Menlo', default: 'monospace' });

/** Profil & Pengaturan: wallet, preferensi tampilan, keamanan, dan Buku Alamat. */
export default function ProfileScreen() {
  const colors = useThemeColors();
  const { formatFiat } = useFormat();
  const { t } = useI18n();
  const toast = useToast();
  const { contacts } = useContacts();
  const { settings, updateSettings } = useSettings();
  const [sheet, setSheet] = useState<'currency' | 'language' | 'theme' | null>(null);
  const { accounts, isDemo } = useWalletAccounts();
  const s = t.settings;
  const soon = () => toast({ title: t.common.comingSoon, message: s.soonMessage });
  const version = Constants.expoConfig?.version ?? '–';

  return (
    <TabScreen active={null} title={s.title}>
      <View className="gap-3 rounded-[20px] bg-surface p-4" style={cardShadow}>
        <View className="flex-row items-center gap-3">
          <View className="h-12 w-12 items-center justify-center rounded-full bg-teal-500">
            <Ionicons name="wallet" size={22} color={colors.white} />
          </View>
          <View className="flex-1">
            <Text className="text-base font-bold text-ink">{s.walletName}</Text>
            <Text className="text-xs text-ink-muted">{s.nonCustodial}</Text>
          </View>
          {isDemo && (
            <View className="rounded-full bg-warning-50 px-2.5 py-1">
              <Text className="text-[11px] font-semibold text-warning-600">{s.demoBadge}</Text>
            </View>
          )}
        </View>
        <View className="gap-1.5 rounded-2xl bg-subtle px-3 py-2.5">
          {(
            [
              ['EVM', accounts.evm],
              ['Solana', accounts.solana],
            ] as const
          ).map(([label, address]) => (
            <View key={label} className="flex-row items-center justify-between gap-2">
              <Text className="text-xs font-semibold text-ink-soft">{label}</Text>
              <Text className="text-xs text-ink-muted" style={{ fontFamily: monoFont }}>
                {shortenAddress(address)}
              </Text>
            </View>
          ))}
        </View>
      </View>

      <SettingsGroup title={s.general}>
        <SettingsRow
          icon="cash-outline"
          label={s.currency}
          value={s.currencyValue[settings.displayCurrency]}
          onPress={() => setSheet('currency')}
        />
        <SettingsRow
          icon="language-outline"
          label={s.language}
          value={s.languageValue[settings.language]}
          onPress={() => setSheet('language')}
        />
        <SettingsRow
          icon="contrast-outline"
          label={s.theme}
          value={s.themeValue[settings.theme]}
          onPress={() => setSheet('theme')}
          isLast
        />
      </SettingsGroup>

      <SettingsGroup title={s.security}>
        <SettingsRow
          icon="lock-closed-outline"
          label={s.autoLock}
          value={s.autoLockValue(settings.autoLockMinutes)}
          onPress={soon}
        />
        <SettingsRow
          icon="finger-print"
          label={s.biometricSigning}
          hint={s.biometricSigningHint}
          trailing={
            <Switch
              value={settings.biometricSigning}
              onValueChange={soon}
              accessibilityLabel={s.biometricSigning}
              trackColor={{ true: colors.primary[500], false: colors.line }}
              thumbColor={colors.white}
            />
          }
        />
        <SettingsRow
          icon="key-outline"
          label={s.recoveryPhrase}
          hint={s.recoveryPhraseHint}
          onPress={soon}
          isLast
        />
      </SettingsGroup>

      <SettingsGroup title={s.other}>
        <SettingsRow
          icon="people-outline"
          label={t.contacts.title}
          value={t.contacts.count(contacts.length)}
          onPress={() => router.push('/contacts')}
        />
        <SettingsRow icon="information-circle-outline" label={s.version} value={version} isLast />
      </SettingsGroup>

      <SettingsGroup title={s.dangerZone}>
        <SettingsRow
          icon="trash-outline"
          label={s.removeWallet}
          hint={s.removeWalletHint}
          tone="danger"
          onPress={soon}
          isLast
        />
      </SettingsGroup>

      <OptionSheet
        visible={sheet === 'currency'}
        onClose={() => setSheet(null)}
        title={s.currency}
        description={s.currencyDescription}
        options={(['IDR', 'USD'] as const).map((currency) => ({
          value: currency,
          label: s.currencyValue[currency],
          hint: s.currencyExample(formatFiat(1, currency, MOCK_FX_RATES)),
        }))}
        selected={settings.displayCurrency}
        onSelect={(displayCurrency) => {
          updateSettings({ displayCurrency });
          toast({ variant: 'success', title: s.currencyChanged(s.currencyValue[displayCurrency]) });
        }}
      />

      <OptionSheet
        visible={sheet === 'language'}
        onClose={() => setSheet(null)}
        title={s.language}
        options={(['id', 'en'] as const).map((language) => ({
          value: language,
          label: s.languageValue[language],
          hint: s.languageNative[language],
        }))}
        selected={settings.language}
        onSelect={(language) => updateSettings({ language })}
      />

      <OptionSheet
        visible={sheet === 'theme'}
        onClose={() => setSheet(null)}
        title={s.theme}
        options={(['light', 'dark', 'system'] as const).map((theme) => ({
          value: theme,
          label: s.themeValue[theme],
          hint: s.themeHint[theme],
        }))}
        selected={settings.theme}
        onSelect={(theme) => updateSettings({ theme })}
      />
    </TabScreen>
  );
}
