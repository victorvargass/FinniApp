import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FloatingActionButton } from '@/components/floating-action-button';
import { FeatureGuide, FeatureGuideButton, useFeatureGuide } from '@/components/feature-guide';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors } from '@/constants/theme';
import { useDatabase } from '@/contexts/DatabaseContext';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Alert } from '@/lib/alert';
import { t } from '@/lib/i18n';
import { showToast } from '@/lib/toast';

function showDefaultConfirmation(name: string) {
  showToast(t('paymentMethods.defaultConfirmation', { name }));
}

export default function PaymentMethodsScreen() {
  const { paymentMethods, settings, setDefaultPaymentMethod } = useDatabase();
  const colors = Colors[useColorScheme() ?? 'light'];
  const guide = useFeatureGuide('payment-methods');
  const guideSlides = [
    {
      icon: 'business-outline' as const,
      title: t('featureGuides.paymentMethods.startTitle'),
      body: t('featureGuides.paymentMethods.startBody'),
    },
    {
      icon: 'card-outline' as const,
      title: t('featureGuides.paymentMethods.conceptsTitle'),
      body: t('featureGuides.paymentMethods.conceptsBody'),
    },
    {
      icon: 'calculator-outline' as const,
      title: t('featureGuides.paymentMethods.trackingTitle'),
      body: t('featureGuides.paymentMethods.trackingBody'),
    },
    {
      icon: 'sync-outline' as const,
      title: t('featureGuides.paymentMethods.syncTitle'),
      body: t('featureGuides.paymentMethods.syncBody'),
    },
  ];
  const typeLabels = {
    cash: t('paymentMethods.cash'),
    debit: t('paymentMethods.debit'),
    prepaid: t('paymentMethods.prepaid'),
    credit: t('paymentMethods.credit'),
  };

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <FlatList
        data={paymentMethods}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <View style={styles.guideHeader}>
            <ThemedText style={styles.intro}>
              {t('paymentMethods.intro')}
            </ThemedText>
            <FeatureGuideButton onPress={guide.open} />
          </View>
        }
        renderItem={({ item }) => (
          <ThemedView style={[styles.card, !item.active && styles.inactive]}>
            <View style={[styles.colorDot, { backgroundColor: item.color }]} />
            <Pressable
              onPress={() => router.push({ pathname: '/modal/payment-method-detail', params: { id: String(item.id) } })}
              style={styles.main}>
              <View style={styles.copy}>
                <ThemedText type="defaultSemiBold">{item.name}</ThemedText>
                <ThemedText style={styles.secondary}>
                  {typeLabels[item.type]}{item.billingDay ? t('paymentMethods.approximateBilling', { day: item.billingDay }) : ''}
                </ThemedText>
                {item.type !== 'cash' && (
                  item.availableBalance == null ? (
                    <Pressable
                      accessibilityRole="button"
                      onPress={(event) => {
                        event.stopPropagation();
                        router.push({
                          pathname: '/modal/payment-method-balance',
                          params: { id: String(item.id) },
                        });
                      }}
                      style={styles.configureBalance}>
                      <Ionicons name="sync-outline" size={15} color={colors.action} />
                      <ThemedText type="defaultSemiBold" style={[styles.balance, { color: colors.action }]}>
                        {t('paymentMethods.configureCurrentBalance')}
                      </ThemedText>
                    </Pressable>
                  ) : (
                    <ThemedText type="defaultSemiBold" style={styles.balance}>
                      {`${item.type === 'credit' ? t('paymentMethods.availableCredit') : t('paymentMethods.availableBalance')}: ${new Intl.NumberFormat(undefined, { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(item.availableBalance)}`}
                    </ThemedText>
                  )
                )}
              </View>
            </Pressable>
            <Pressable
              accessibilityLabel={settings.defaultPaymentMethodId === item.id
                ? t('paymentMethods.removeDefault', { name: item.name })
                : t('paymentMethods.useAsDefault', { name: item.name })}
              accessibilityRole="button"
              disabled={!item.active}
              onPress={() => {
                const willBeDefault = settings.defaultPaymentMethodId !== item.id;
                setDefaultPaymentMethod(willBeDefault ? item.id : null)
                  .then(() => {
                    if (willBeDefault) showDefaultConfirmation(item.name);
                  })
                  .catch((error) => Alert.alert(
                    t('errors.couldNotChange'),
                    error instanceof Error ? error.message : t('common.tryAgain')
                  ));
              }}
              style={[styles.star, !item.active && styles.starDisabled]}>
              <Ionicons
                name={settings.defaultPaymentMethodId === item.id ? 'star' : 'star-outline'}
                size={22}
                color={settings.defaultPaymentMethodId === item.id ? '#D88916' : colors.icon}
              />
            </Pressable>
            {item.type === 'credit' && (
              <Pressable
                accessibilityLabel={t('paymentMethods.viewStatements', { name: item.name })}
                accessibilityRole="button"
                onPress={() => router.push({ pathname: '/modal/card-cycles', params: { id: String(item.id) } })}
                style={styles.statementButton}>
                <Ionicons name="receipt-outline" size={21} color={colors.primary} />
              </Pressable>
            )}
            <Pressable
              accessibilityLabel={t('paymentMethods.configure', { name: item.name })}
              onPress={() => router.push({ pathname: '/modal/payment-method-detail', params: { id: String(item.id) } })}
              style={styles.chevron}>
              <Ionicons name="chevron-forward" size={21} color={colors.icon} />
            </Pressable>
          </ThemedView>
        )}
      />
      <FeatureGuide visible={guide.visible} slides={guideSlides} onClose={guide.close} />
      <FloatingActionButton href="/modal/payment-method-form" accessibilityLabel={t('paymentMethods.add')} avoidBottomInset />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  list: { padding: 20, paddingBottom: 100, gap: 10 },
  guideHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 8 },
  intro: { flex: 1, opacity: 0.7, lineHeight: 20 },
  card: { borderRadius: 12, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 8 },
  inactive: { opacity: 0.55 },
  main: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  colorDot: { width: 18, height: 18, borderRadius: 6 },
  copy: { flex: 1, gap: 3 },
  secondary: { opacity: 0.65, fontSize: 13 },
  balance: { fontSize: 12, marginTop: 2 },
  configureBalance: { flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start' },
  chevron: { paddingVertical: 8, paddingLeft: 4 },
  star: { padding: 6 },
  statementButton: { padding: 6 },
  starDisabled: { opacity: 0.35 },
});
