import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors, Fonts } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import * as database from '@/repositories';
import { formatDate, formatMoney } from '@/lib/format';
import { buildGlobalSearchResults, type GlobalSearchData, type GlobalSearchKind, type GlobalSearchResult } from '@/lib/global-search';
import { t } from '@/lib/i18n';

const EMPTY_DATA: GlobalSearchData = {
  expenses: [], incomes: [], contacts: [], debts: [], debtPlans: [], paymentMethods: [], savingsGoals: [],
};

const KIND_ORDER: GlobalSearchKind[] = ['expense', 'income', 'contact', 'debt', 'installment', 'payment-method', 'savings-goal'];

const ICONS: Record<GlobalSearchKind, keyof typeof Ionicons.glyphMap> = {
  expense: 'arrow-up-outline',
  income: 'arrow-down-outline',
  contact: 'person-outline',
  debt: 'cash-outline',
  installment: 'calendar-outline',
  'payment-method': 'wallet-outline',
  'savings-goal': 'flag-outline',
};

function openResult(result: GlobalSearchResult) {
  const pathname = {
    expense: '/modal/expense-form',
    income: '/modal/income-form',
    contact: '/modal/contact-form',
    debt: '/modal/manual-debt-detail',
    installment: '/modal/debt-detail',
    'payment-method': '/modal/payment-method-detail',
    'savings-goal': '/modal/savings-goal-form',
  }[result.kind];
  router.push({ pathname: pathname as never, params: { id: String(result.id) } });
}

export default function GlobalSearchScreen() {
  const colors = Colors[useColorScheme() ?? 'light'];
  const [query, setQuery] = useState('');
  const [data, setData] = useState<GlobalSearchData>(EMPTY_DATA);
  const [loading, setLoading] = useState(true);

  useFocusEffect(useCallback(() => {
    let active = true;
    setLoading(true);
    Promise.all([
      database.getExpenses(), database.getIncomes(), database.getContacts(), database.getDebts(),
      database.getDebtPlans(), database.getPaymentMethods(true), database.getSavingsGoals(true),
    ]).then(([expenses, incomes, contacts, debts, debtPlans, paymentMethods, savingsGoals]) => {
      if (active) setData({ expenses, incomes, contacts, debts, debtPlans, paymentMethods, savingsGoals });
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []));

  const results = useMemo(() => buildGlobalSearchResults(query, data), [data, query]);
  const groups = KIND_ORDER.map((kind) => ({ kind, items: results.filter((item) => item.kind === kind) }))
    .filter((group) => group.items.length > 0);
  const hasQuery = query.trim().length >= 2;

  return (
    <SafeAreaView edges={['bottom']} style={[styles.safe, { backgroundColor: colors.screen }]}>
      <View style={[styles.search, { borderColor: colors.border, backgroundColor: colors.surfaceRaised }]}>
        <Ionicons name="search-outline" size={21} color={colors.icon} />
        <TextInput
          accessibilityLabel={t('globalSearch.inputLabel')}
          autoCapitalize="none"
          autoCorrect={false}
          autoFocus
          onChangeText={setQuery}
          placeholder={t('globalSearch.placeholder')}
          placeholderTextColor={colors.icon}
          returnKeyType="search"
          style={[styles.input, { color: colors.text }]}
          testID="global-search-input"
          value={query}
        />
        {query.length > 0 && (
          <Pressable accessibilityLabel={t('common.clearSearch')} accessibilityRole="button" hitSlop={10} onPress={() => setQuery('')}>
            <Ionicons name="close-circle" size={21} color={colors.icon} />
          </Pressable>
        )}
      </View>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {loading ? (
          <View style={styles.state}><ActivityIndicator color={colors.primary} /><ThemedText>{t('common.loading')}</ThemedText></View>
        ) : !hasQuery ? (
          <View style={styles.state}><Ionicons name="search-outline" size={34} color={colors.icon} /><ThemedText style={styles.stateText}>{t('globalSearch.hint')}</ThemedText></View>
        ) : results.length === 0 ? (
          <View style={styles.state}><Ionicons name="file-tray-outline" size={34} color={colors.icon} /><ThemedText style={styles.stateText}>{t('globalSearch.empty')}</ThemedText></View>
        ) : groups.map((group) => (
          <View key={group.kind} style={styles.group}>
            <ThemedText accessibilityRole="header" style={styles.groupTitle}>{t(`globalSearch.groups.${group.kind}`)}</ThemedText>
            {group.items.map((item) => (
              <Pressable
                accessibilityRole="button"
                key={item.key}
                onPress={() => openResult(item)}
                style={({ pressed }) => pressed && styles.pressed}>
                <ThemedView style={[styles.result, { borderColor: colors.border }]}>
                  <View style={[styles.icon, { backgroundColor: `${colors.action}18` }]}><Ionicons name={ICONS[item.kind]} size={20} color={colors.action} /></View>
                  <View style={styles.copy}>
                    <ThemedText numberOfLines={1} type="defaultSemiBold">{item.title}</ThemedText>
                    <ThemedText numberOfLines={1} style={[styles.meta, { color: colors.textSecondary }]}>
                      {[item.meta, item.date ? formatDate(new Date(`${item.date}T12:00:00`)) : null].filter(Boolean).join(' · ')}
                    </ThemedText>
                  </View>
                  {item.amount != null && <ThemedText type="defaultSemiBold">{formatMoney(item.amount, item.currency)}</ThemedText>}
                  <Ionicons name="chevron-forward" size={18} color={colors.icon} />
                </ThemedView>
              </Pressable>
            ))}
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  search: { minHeight: 52, margin: 16, marginBottom: 4, borderWidth: 1, borderRadius: 13, paddingHorizontal: 13, flexDirection: 'row', alignItems: 'center', gap: 9 },
  input: { flex: 1, fontSize: 16, fontFamily: Fonts.regular, paddingVertical: 10 },
  content: { flexGrow: 1, padding: 16, paddingBottom: 40, gap: 18 },
  state: { flex: 1, minHeight: 320, alignItems: 'center', justifyContent: 'center', gap: 12, paddingHorizontal: 30 },
  stateText: { textAlign: 'center', opacity: 0.68 },
  group: { gap: 7 }, groupTitle: { fontSize: 13, fontWeight: '700', opacity: 0.65, textTransform: 'uppercase', paddingHorizontal: 4 },
  result: { minHeight: 64, borderWidth: 1, borderRadius: 12, padding: 10, flexDirection: 'row', alignItems: 'center', gap: 10 },
  icon: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  copy: { flex: 1, gap: 3 }, meta: { fontSize: 12 }, pressed: { opacity: 0.7 },
});
