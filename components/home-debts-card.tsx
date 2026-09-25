import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, View } from 'react-native';

import { ExpandableFinanceCard } from '@/components/expandable-finance-card';
import { ThemedText } from '@/components/themed-text';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { formatCLP, formatDate } from '@/lib/format';
import { t } from '@/lib/i18n';
import { getCardDueDate } from '@/lib/payment-method-calculations';
import type { Debt, DebtPlan, PaymentMethod } from '@/lib/types';

type HomeDebtsCardProps = {
  debts: Debt[];
  plans: DebtPlan[];
  paymentMethods: PaymentMethod[];
  backgroundColor: string;
  onManage: () => void;
  onOpenDebt: (id: number) => void;
  onOpenPlan: (id: number) => void;
  onOpenPaymentMethod: (id: number) => void;
};

type DebtRowProps = {
  color: string;
  name: string;
  detail: string;
  amount: number;
  total: number | null;
  onPress: () => void;
};

function DebtRow({ color, name, detail, amount, total, onPress }: DebtRowProps) {
  const colors = Colors[useColorScheme() ?? 'light'];
  const progress = total && total > 0
    ? Math.min(1, Math.max(0, 1 - amount / total))
    : 0;

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.item, pressed && styles.pressed]}>
      <View style={styles.itemHeader}>
        <View style={[styles.dot, { backgroundColor: color }]} />
        <View style={styles.itemCopy}>
          <ThemedText type="defaultSemiBold" numberOfLines={1}>{name}</ThemedText>
          <ThemedText style={[styles.detail, { color: colors.textSecondary }]}>{detail}</ThemedText>
        </View>
        <ThemedText type="defaultSemiBold">{formatCLP(amount)}</ThemedText>
        <Ionicons name="chevron-forward" size={18} color={colors.icon} />
      </View>
      {total != null && total > 0 && (
        <View style={[styles.track, { backgroundColor: colors.border }]}>
          <View style={[styles.fill, { width: `${progress * 100}%`, backgroundColor: color }]} />
        </View>
      )}
    </Pressable>
  );
}

export function HomeDebtsCard({
  debts,
  plans,
  paymentMethods,
  backgroundColor,
  onManage,
  onOpenDebt,
  onOpenPlan,
  onOpenPaymentMethod,
}: HomeDebtsCardProps) {
  const activeDebts = debts.filter((item) => item.status === 'active');
  const payableDebts = activeDebts.filter((item) => item.direction === 'payable');
  const receivableDebts = activeDebts.filter((item) => item.direction === 'receivable');
  const activePlans = plans.filter((item) => item.status === 'active' || item.status === 'projected');
  const creditCards = paymentMethods.filter((item) =>
    item.active && item.type === 'credit' && (item.usedAmount ?? 0) > 0
  );
  if (activeDebts.length === 0 && activePlans.length === 0 && creditCards.length === 0) return null;

  const totalBalance = payableDebts.reduce((sum, item) => sum + item.currentBalance, 0)
    + creditCards.reduce((sum, item) => sum + (item.usedAmount ?? 0), 0);
  const totalReceivable = receivableDebts.reduce((sum, item) => sum + item.currentBalance, 0);

  return (
    <ExpandableFinanceCard
      title={t('navigation.debts')}
      summary={totalReceivable > 0
        ? t('debts.homeSummaryWithReceivable', { payable: formatCLP(totalBalance), receivable: formatCLP(totalReceivable) })
        : t('debts.homeSummary', { amount: formatCLP(totalBalance) })}
      backgroundColor={backgroundColor}
      manageAccessibilityLabel={t('accessibility.debtDetails')}
      onManage={onManage}>
      <View style={styles.list}>
        {creditCards.length > 0 && (
          <ThemedText style={styles.sectionLabel}>{t('debts.creditCards')}</ThemedText>
        )}
        {creditCards.map((card) => {
          const dueDate = getCardDueDate(card);
          return (
            <DebtRow
              key={`card-${card.id}`}
              color={card.color}
              name={card.name}
              detail={dueDate
                ? t(dueDate.estimated ? 'debts.homeCardEstimatedDue' : 'debts.homeCardDue', {
                    date: formatDate(dueDate.date),
                  })
                : t('paymentMethods.credit')}
              amount={card.usedAmount ?? 0}
              total={card.creditLimit}
              onPress={() => onOpenPaymentMethod(card.id)}
            />
          );
        })}

        {payableDebts.length > 0 && (
          <ThemedText style={styles.sectionLabel}>{t('debts.payableSection')}</ThemedText>
        )}
        {payableDebts.map((debt) => (
          <DebtRow
            key={`debt-${debt.id}`}
            color={debt.type === 'fixed' ? '#174A73' : '#D88916'}
            name={debt.name}
            detail={debt.nextDueDate
              ? t('debts.nextDueValue', { date: formatDate(new Date(`${debt.nextDueDate}T12:00:00`)) })
              : debt.contactName ?? debt.creditor ?? t(debt.type === 'fixed' ? 'debts.fixed' : 'debts.variable')}
            amount={debt.currentBalance}
            total={debt.initialAmount}
            onPress={() => onOpenDebt(debt.id)}
          />
        ))}

        {receivableDebts.length > 0 && (
          <ThemedText style={styles.sectionLabel}>{t('debts.receivableSection')}</ThemedText>
        )}
        {receivableDebts.map((debt) => (
          <DebtRow
            key={`receivable-${debt.id}`}
            color="#20A486"
            name={debt.name}
            detail={debt.nextDueDate
              ? t('debts.nextDueValue', { date: formatDate(new Date(`${debt.nextDueDate}T12:00:00`)) })
              : debt.contactName ?? debt.creditor ?? t(debt.type === 'fixed' ? 'debts.fixed' : 'debts.variable')}
            amount={debt.currentBalance}
            total={debt.initialAmount}
            onPress={() => onOpenDebt(debt.id)}
          />
        ))}

        {activePlans.length > 0 && (
          <ThemedText style={styles.sectionLabel}>{t('debts.cardPurchases')}</ThemedText>
        )}
        {activePlans.map((plan) => (
          <DebtRow
            key={`plan-${plan.id}`}
            color={plan.paymentMethodColor}
            name={plan.name}
            detail={t('installments.progressValue', {
              posted: plan.postedInstallments,
              total: plan.totalInstallments,
            })}
            amount={plan.remainingAmount}
            total={plan.totalAmount}
            onPress={() => onOpenPlan(plan.id)}
          />
        ))}
      </View>
    </ExpandableFinanceCard>
  );
}

const styles = StyleSheet.create({
  list: { gap: 12 },
  sectionLabel: {
    marginTop: 2,
    fontSize: 11,
    lineHeight: 16,
    fontWeight: '700',
    opacity: 0.58,
    textTransform: 'uppercase',
  },
  item: { gap: 8 },
  itemHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  itemCopy: { minWidth: 0, flex: 1, gap: 1 },
  detail: { fontSize: 11, lineHeight: 15 },
  track: { height: 7, borderRadius: 4, overflow: 'hidden', marginLeft: 18 },
  fill: { height: '100%', borderRadius: 4 },
  pressed: { opacity: 0.7 },
});
