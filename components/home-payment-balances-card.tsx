import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, View } from 'react-native';

import { ExpandableFinanceCard } from '@/components/expandable-finance-card';
import { ThemedText } from '@/components/themed-text';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { formatCLP } from '@/lib/format';
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
  const methods = getHomePaymentMethods(paymentMethods, kind);
  if (methods.length === 0) return null;

  const total = sumKnownAvailableBalances(methods);
  const pendingCount = methods.filter((method) => method.availableBalance == null).length;
  const summary = t(
    kind === 'wallet' ? 'home.walletTotal' : 'home.availableCreditTotal',
    { amount: formatCLP(total) }
  );
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
            style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
            <View style={[styles.dot, { backgroundColor: method.color }]} />
            <View style={styles.copy}>
              <ThemedText type="defaultSemiBold" numberOfLines={1}>{method.name}</ThemedText>
              <ThemedText style={[styles.type, { color: colors.textSecondary }]}>
                {t(`paymentMethods.${method.type}`)}
              </ThemedText>
            </View>
            <View style={styles.amountCopy}>
              {method.availableBalance == null ? (
                <ThemedText style={[styles.pending, { color: colors.action }]}>
                  {t('paymentMethods.configureCurrentBalance')}
                </ThemedText>
              ) : (
                <ThemedText type="defaultSemiBold">{formatCLP(method.availableBalance)}</ThemedText>
              )}
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
  dot: { width: 10, height: 10, borderRadius: 5 },
  copy: { minWidth: 0, flex: 1, gap: 1 },
  type: { fontSize: 11, lineHeight: 15 },
  amountCopy: { maxWidth: '45%', alignItems: 'flex-end' },
  pending: { fontSize: 11, lineHeight: 15, textAlign: 'right' },
  pressed: { opacity: 0.7 },
});
