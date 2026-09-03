import { useEffect, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';

import { CategoryChart } from '@/components/CategoryChart';
import { BreakdownSection, type BreakdownMode } from '@/components/breakdown-section';
import { LimitProgressBar } from '@/components/LimitProgressBar';
import { PaymentMethodChart } from '@/components/PaymentMethodChart';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { formatCLP, formatDate } from '@/lib/format';
import { t } from '@/lib/i18n';
import type { PeriodHistory } from '@/lib/types';

type Props = {
  visible: boolean;
  period: PeriodHistory | null;
  onClose: () => void;
  onOpenPeriod?: (periodId: number) => void;
  onOpenCategory?: (periodId: number, categoryId: number | null) => void;
  onOpenPaymentMethod?: (periodId: number, paymentMethodId: number | null) => void;
};

export function HistoricalPeriodModal({
  visible,
  period,
  onClose,
  onOpenPeriod,
  onOpenCategory,
  onOpenPaymentMethod,
}: Props) {
  const [categorySelectionReset, setCategorySelectionReset] = useState(0);
  const [breakdownMode, setBreakdownMode] = useState<BreakdownMode>('category');
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];

  useEffect(() => {
    setBreakdownMode('category');
  }, [period?.periodId, visible]);

  if (!period) return null;

  const expenses =
    period.categories?.reduce(
      (sum: number, item: any) => sum + item.total,
      0
    ) ?? 0;

  const incomes = period.incomesTotal ?? 0;
  const savingsWithdrawals = period.savingsWithdrawalTotal ?? 0;
  const savingsFunding = period.savingsFundingTotal ?? 0;
  const savingsAvailable = savingsWithdrawals + savingsFunding;
  const balance = incomes + savingsAvailable - expenses;
  const categories = period.categories ?? [];
  const paymentMethods = period.paymentMethods ?? [];
  const limits = categories.filter(
    (item: any) => item.periodLimit && item.periodLimit > 0
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable
        accessibilityLabel={t('accessibility.closeHistoricalSummary')}
        onPress={onClose}
        style={styles.overlay}>
        <Pressable
          onPress={(event) => event.stopPropagation()}
          style={[styles.container, { backgroundColor: colors.surface }]}>
          <ScrollView showsVerticalScrollIndicator={false}>
  
            <ThemedText type="title" style={styles.headerTitle}>
              {t('historicalPeriod.title')}
            </ThemedText>
  
            <ThemedText style={[styles.datesSummary, { color: colors.textSecondary }]}>
              {formatDate(new Date(`${period.startDate}T12:00:00`))} → {formatDate(new Date(`${period.endDate}T12:00:00`))}
            </ThemedText>
  
            <View style={styles.totalsContainer}>
              <ThemedView style={[styles.summaryCard, { flex: 1, backgroundColor: colors.surfaceRaised }]}>
                <ThemedText style={[styles.label, { color: colors.textSecondary }]}>
                  {t('historicalPeriod.incomes')}
                </ThemedText>

                <ThemedText style={styles.income}>
                  {formatCLP(incomes)}
                </ThemedText>
              </ThemedView>

              <ThemedView style={[styles.summaryCard, { flex: 1, backgroundColor: colors.surfaceRaised }]}>
                <ThemedText style={[styles.label, { color: colors.textSecondary }]}>
                  {t('historicalPeriod.expenses')}
                </ThemedText>

                <ThemedText style={styles.expense}>
                  {formatCLP(expenses)}
                </ThemedText>
              </ThemedView>
            </View>


            <ThemedView style={[styles.balanceCard, { backgroundColor: colors.surfaceRaised }]}>
              <ThemedText style={[styles.label, { color: colors.textSecondary }]}>
                {t('historicalPeriod.balance')}
              </ThemedText>

              <ThemedText
                style={[
                  balance >= 0 ? styles.positive : styles.negative,
                  balance >= 0 && { color: colors.primary },
                ]}
              >
                {formatCLP(balance)}
              </ThemedText>
              {savingsAvailable > 0 && (
                <ThemedText style={[styles.label, { color: colors.textSecondary }]}>
                  {t('savings.releasedInBalance', { amount: formatCLP(savingsAvailable) })}
                </ThemedText>
              )}
            </ThemedView>
  
  
            <BreakdownSection
              mode={breakdownMode}
              onChange={setBreakdownMode}
              backgroundColor={colors.surfaceRaised}
              style={styles.breakdown}
              categoryContent={(
                <>
                  <CategoryChart
                    periodCategoryExpensesTotals={categories}
                    periodExpensesTotal={expenses}
                    surfaceColor={colors.surfaceRaised}
                    selectionResetKey={`${period.periodId}-${categorySelectionReset}`}
                    onOpenCategory={onOpenCategory
                      ? (categoryId) => onOpenCategory(period.periodId, categoryId)
                      : undefined}
                  />

                  {limits.length > 0 && (
                    <View style={[styles.limitsSection, { borderTopColor: colors.border }]}>
                      <ThemedText type="subtitle">{t('historicalPeriod.limits')}</ThemedText>
                      <View style={styles.limitList}>
                        {limits.map((item: any) => (
                          <LimitProgressBar
                            key={item.categoryId}
                            name={item.categoryName}
                            color={item.categoryColor}
                            spent={item.total}
                            limit={item.periodLimit}
                          />
                        ))}
                      </View>
                    </View>
                  )}
                </>
              )}
              paymentMethodContent={(
                <PaymentMethodChart
                  items={paymentMethods}
                  total={expenses}
                  surfaceColor={colors.surfaceRaised}
                  selectionResetKey={period.periodId}
                  onSelectPaymentMethod={() => setCategorySelectionReset((value) => value + 1)}
                  onOpenPaymentMethod={onOpenPaymentMethod
                    ? (paymentMethodId) => onOpenPaymentMethod(period.periodId, paymentMethodId)
                    : undefined}
                />
              )}
            />
  
            {onOpenPeriod && (
              <Pressable
                style={({ pressed }) => [
                  styles.openButton,
                  { backgroundColor: colors.primary },
                  pressed && styles.exportButtonPressed,
                ]}
                onPress={() => onOpenPeriod(period.periodId)}>
                <ThemedText style={styles.exportButtonText}>
                  {t('historicalPeriod.openPeriod')}
                </ThemedText>
              </Pressable>
            )}

            <Pressable
              style={[styles.closeButton, { borderColor: colors.border }]}
              onPress={onClose}
            >
              <ThemedText style={[styles.closeButtonText, { color: colors.primary }]}>
                {t('common.close')}
              </ThemedText>
            </Pressable>
  
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    padding: 16,
  },

  container: {
    maxHeight: '88%',
    borderRadius: 18,
    padding: 16,
  },

  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    textAlign: 'center',
  },

  datesSummary: {
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 16,
    fontSize: 14,
    color: '#888',
  },

  summaryBox: {
    borderRadius: 14,
    padding: 14,
    backgroundColor: '#fbfcfd',
    marginBottom: 14,
  },

  summaryItem: {
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
  },

  divider: {
    height: 1,
    backgroundColor: '#eee',
    marginVertical: 6,
  },

  income: {
    fontSize: 22,
    fontWeight: '700',
    color: '#008000',
  },

  expense: {
    fontSize: 22,
    fontWeight: '700',
    color: '#e44332',
  },

  positive: {
    fontSize: 22,
    fontWeight: '700',
    color: '#006080',
  },

  negative: {
    fontSize: 22,
    fontWeight: '700',
    color: '#e44332',
  },

  limitList: {
    gap: 12,
  },

  breakdown: {
    marginBottom: 12,
  },

  limitsSection: {
    borderTopWidth: 1,
    marginTop: 18,
    paddingTop: 18,
    gap: 14,
  },

  openButton: {
    marginTop: 8,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },

  exportButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
  },

  exportButtonPressed: {
    opacity: 0.72,
  },

  closeButton: {
    marginTop: 8,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ddd',
  },

  closeButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#006080',
  },
  totalsContainer: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 10,
  },
  
  summaryCard: {
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 10,
    alignItems: 'center',
    backgroundColor: '#fbfcfd',
  },
  
  balanceCard: {
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    backgroundColor: '#fbfcfd',
    marginBottom: 14,
  },
  
  label: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
});
