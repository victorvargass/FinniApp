import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { t } from '@/lib/i18n';

export default function QuickAddScreen() {
  const colors = Colors[useColorScheme() ?? 'light'];
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
      key: 'transfer',
      icon: 'swap-horizontal-outline' as const,
      title: t('quickAdd.transferTitle'),
      description: t('quickAdd.transferDescription'),
      accent: colors.secondary,
      onPress: () => router.replace('/modal/account-transfer-form' as never),
    },
  ];

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.screen }]} edges={['bottom']}>
      <View style={styles.content}>
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
                  <Ionicons name={option.icon} size={30} color={option.accent} />
                </View>
                <View style={styles.optionCopy}>
                  <ThemedText type="subtitle">{option.title}</ThemedText>
                  <ThemedText style={[styles.optionDescription, { color: colors.textSecondary }]}>
                    {option.description}
                  </ThemedText>
                </View>
                <Ionicons name="chevron-forward" size={22} color={colors.icon} />
              </ThemedView>
            </Pressable>
          ))}
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { flex: 1, padding: 20, gap: 26 },
  heading: { gap: 8 },
  description: { fontSize: 15, lineHeight: 22 },
  options: { gap: 14 },
  option: {
    minHeight: 104,
    borderWidth: 1,
    borderRadius: 18,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  icon: { width: 54, height: 54, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  optionCopy: { flex: 1, gap: 3 },
  optionDescription: { fontSize: 13, lineHeight: 18 },
  pressed: { opacity: 0.7 },
});
