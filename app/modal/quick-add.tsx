import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors } from '@/constants/theme';
import { useDatabaseState } from '@/contexts/DatabaseContext';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { t } from '@/lib/i18n';

export default function QuickAddScreen() {
  const colors = Colors[useColorScheme() ?? 'light'];
  const { paymentMethods } = useDatabaseState();
  const hasActiveCreditCard = paymentMethods.some(
    (method) => method.active && method.type === 'credit'
  );
  const options = [
    {
      key: 'expense',
      icon: 'arrow-up-circle-outline' as const,
      title: t('quickAdd.expenseTitle'),
      description: t('quickAdd.expenseDescription'),
      accent: colors.expense,
      onPress: () => router.replace('/modal/expense-form'),
    },
    {
      key: 'income',
      icon: 'arrow-down-circle-outline' as const,
      title: t('quickAdd.incomeTitle'),
      description: t('quickAdd.incomeDescription'),
      accent: colors.success,
      onPress: () => router.replace('/modal/income-form'),
    },
    {
      key: 'debt-payment',
      icon: 'cash-outline' as const,
      title: t('quickAdd.debtPaymentTitle'),
      description: t('quickAdd.debtPaymentDescription'),
      accent: colors.expense,
      onPress: () => router.replace({
        pathname: '/modal/manual-debt-payment',
        params: { direction: 'payable' },
      }),
    },
    {
      key: 'debt-collection',
      icon: 'download-outline' as const,
      title: t('quickAdd.debtCollectionTitle'),
      description: t('quickAdd.debtCollectionDescription'),
      accent: colors.success,
      onPress: () => router.replace({
        pathname: '/modal/manual-debt-payment',
        params: { direction: 'receivable' },
      }),
    },
    {
      key: 'transfer',
      icon: 'swap-horizontal-outline' as const,
      title: t('quickAdd.transferTitle'),
      description: t('quickAdd.transferDescription'),
      accent: colors.secondary,
      onPress: () => router.replace('/modal/account-transfer-form' as never),
    },
    ...(hasActiveCreditCard
      ? [{
          key: 'card-payment',
          icon: 'card-outline' as const,
          title: t('quickAdd.cardPaymentTitle'),
          description: t('quickAdd.cardPaymentDescription'),
          accent: colors.warning,
          onPress: () => router.replace({
            pathname: '/modal/expense-form',
            params: { cardPayment: 'true' },
          }),
        }]
      : []),
    {
      key: 'savings',
      icon: 'wallet-outline' as const,
      title: t('quickAdd.savingsTitle'),
      description: t('quickAdd.savingsDescription'),
      accent: colors.savings,
      onPress: () => router.replace({
        pathname: '/modal/expense-form',
        params: { savingsContribution: 'true' },
      }),
    },
  ];

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.screen }]} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.heading}>
          <ThemedText type="title">{t('quickAdd.title')}</ThemedText>
          <ThemedText style={[styles.description, { color: colors.textSecondary }]}>
            {t('quickAdd.description')}
          </ThemedText>
        </View>

        <View style={styles.options}>
          {options.map((option) => (
            <Pressable
              accessibilityRole="button"
              key={option.key}
              onPress={option.onPress}
              style={({ pressed }) => pressed && styles.pressed}>
              <ThemedView style={[styles.option, { borderColor: colors.border }]}>
                <View style={[styles.icon, { backgroundColor: `${option.accent}1F` }]}>
                  <Ionicons name={option.icon} size={24} color={option.accent} />
                </View>
                <View style={styles.optionCopy}>
                  <ThemedText type="defaultSemiBold" style={styles.optionTitle}>{option.title}</ThemedText>
                  <ThemedText
                    numberOfLines={2}
                    style={[styles.optionDescription, { color: colors.textSecondary }]}>
                    {option.description}
                  </ThemedText>
                </View>
                <Ionicons name="chevron-forward" size={22} color={colors.icon} />
              </ThemedView>
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 18, gap: 16 },
  heading: { gap: 4 },
  description: { fontSize: 14, lineHeight: 19 },
  options: { gap: 8 },
  option: {
    minHeight: 74,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 9,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
  },
  icon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  optionCopy: { flex: 1, gap: 1 },
  optionTitle: { fontSize: 17 },
  optionDescription: { fontSize: 12, lineHeight: 15 },
  pressed: { opacity: 0.7 },
});
