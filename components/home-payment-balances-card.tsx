import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, View } from 'react-native';

import { ExpandableFinanceCard } from '@/components/expandable-finance-card';
import { ThemedText } from '@/components/themed-text';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useLargeTextLayout } from '@/hooks/use-large-text-layout';
import { formatCLP, formatMoney } from '@/lib/format';
import { visibleHomePaymentMethods } from '@/lib/home-visibility';
import { t } from '@/lib/i18n';
import {
  getHomePaymentMethods,
  type HomePaymentBalanceKind,
  sumKnownAvailableBalances,
} from '@/lib/payment-method-groups';
import type { PaymentMethod } from '@/lib/types';

type HomePaymentBalancesCardProps = {
  kind: HomePaymentBalanceKind;
  paymentMethods: PaymentMethod[];
  backgroundColor: string;
  onManage: () => void;
  onOpenPaymentMethod: (id: number) => void;
};

export function HomePaymentBalancesCard({
  kind,
  paymentMethods,
  backgroundColor,
  onManage,
  onOpenPaymentMethod,
}: HomePaymentBalancesCardProps) {
  const colors = Colors[useColorScheme() ?? 'light'];
  const usesLargeText = useLargeTextLayout();
  const methods = getHomePaymentMethods(
    visibleHomePaymentMethods(paymentMethods),
    kind
  );
  if (methods.length === 0) return null;

  const total = sumKnownAvailableBalances(methods);
  const hasUsdCredit = kind === 'credit' && methods.some((method) => method.usdCreditLimitCents != null);
  const usdAvailableTotalCents = methods.reduce(
    (sum, method) => sum + (method.usdAvailableCreditCents ?? 0),
    0
  );
  const pendingCount = methods.filter((method) => method.availableBalance == null).length;
  const summary = kind === 'wallet'
    ? t('home.walletTotal', { amount: formatCLP(total) })
    : hasUsdCredit
      ? t('home.availableCreditTotals', {
          clp: formatCLP(total),
          usd: formatMoney(usdAvailableTotalCents, 'USD'),
        })
      : t('home.availableCreditTotal', { amount: formatCLP(total) });
  const title = t(kind === 'wallet' ? 'home.wallet' : 'home.availableCredit');

  return (
    <ExpandableFinanceCard
      title={title}
      summary={pendingCount > 0
        ? `${summary} · ${t('home.unconfiguredBalances', { count: pendingCount })}`
        : summary}
      backgroundColor={backgroundColor}
      manageAccessibilityLabel={t('home.managePaymentBalances', { section: title })}
      onManage={onManage}>
      <View style={styles.list}>
        {methods.map((method) => (
          <Pressable
            accessibilityRole="button"
            key={method.id}
            onPress={() => onOpenPaymentMethod(method.id)}
            style={({ pressed }) => [styles.row, usesLargeText && styles.rowLargeText, pressed && styles.pressed]}>
            <View style={[styles.dot, { backgroundColor: method.color }]} />
            <View style={styles.copy}>
              <ThemedText type="defaultSemiBold" numberOfLines={usesLargeText ? undefined : 1}>{method.name}</ThemedText>
              <ThemedText style={[styles.type, { color: colors.textSecondary }]}>
                {t(`paymentMethods.${method.type}`)}
              </ThemedText>
            </View>
            <View style={[styles.amountCopy, usesLargeText && styles.amountCopyLargeText]}>
              {kind === 'credit' && (
                <>
                  <ThemedText style={styles.valueHeading}>{t('paymentMethods.availableCredits')}</ThemedText>
                  <ThemedText type="defaultSemiBold" style={[styles.currencyValue, { color: colors.primary }]}>
                    CLP {method.availableBalance == null ? '—' : formatCLP(method.availableBalance)}
                  </ThemedText>
                  {method.usdCreditLimitCents != null && (
                    <ThemedText type="defaultSemiBold" style={[styles.currencyValue, { color: colors.primary }]}>
                      {formatMoney(method.usdAvailableCreditCents ?? 0, 'USD')}
                    </ThemedText>
                  )}
                  <ThemedText style={[styles.billedAmount, { color: method.billedAmount > 0 ? colors.expense : colors.textSecondary }]}>
                    {t('paymentMethods.billedToPay')}: {formatCLP(method.billedAmount)}
                  </ThemedText>
                  <ThemedText style={[styles.valueHeading, styles.totalHeading]}>
                    {t('paymentMethods.totalCredits')}
                  </ThemedText>
                  <ThemedText style={[styles.creditLimit, { color: colors.textSecondary }]}>
                    CLP {method.creditLimit == null ? '—' : formatCLP(method.creditLimit)}
                  </ThemedText>
                  {method.usdCreditLimitCents != null && (
                    <ThemedText style={[styles.creditLimit, { color: colors.textSecondary }]}>
                      {formatMoney(method.usdCreditLimitCents, 'USD')}
                    </ThemedText>
                  )}
                </>
              )}
              {kind !== 'credit' && (method.availableBalance == null ? (
                <ThemedText style={[styles.pending, { color: colors.action }]}>
                  {t('paymentMethods.configureCurrentBalance')}
                </ThemedText>
              ) : (
                <ThemedText type="defaultSemiBold">{formatCLP(method.availableBalance)}</ThemedText>
              ))}
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.icon} />
          </Pressable>
        ))}
      </View>
    </ExpandableFinanceCard>
  );
}

const styles = StyleSheet.create({
  list: { gap: 14 },
  row: { minHeight: 42, flexDirection: 'row', alignItems: 'center', gap: 8 },
  rowLargeText: { flexWrap: 'wrap', alignItems: 'flex-start' },
  dot: { width: 10, height: 10, borderRadius: 5 },
  copy: { minWidth: 0, flex: 1, gap: 1 },
  type: { fontSize: 11, lineHeight: 15 },
  amountCopy: { maxWidth: '58%', alignItems: 'flex-end' },
  amountCopyLargeText: { width: '100%', maxWidth: '100%', alignItems: 'flex-start', paddingLeft: 18 },
  valueHeading: { fontSize: 10, lineHeight: 14, fontWeight: '700', opacity: 0.72, textTransform: 'uppercase' },
  totalHeading: { marginTop: 4 },
  currencyValue: { fontSize: 12, lineHeight: 16, textAlign: 'right' },
  billedAmount: { fontSize: 11, lineHeight: 15, textAlign: 'right' },
  creditLimit: { fontSize: 11, lineHeight: 15, textAlign: 'right' },
  pending: { fontSize: 11, lineHeight: 15, textAlign: 'right' },
  pressed: { opacity: 0.7 },
});
