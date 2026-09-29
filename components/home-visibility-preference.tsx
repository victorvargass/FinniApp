import { StyleSheet, Switch, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { t } from '@/lib/i18n';

type HomeVisibilityPreferenceProps = {
  value: boolean;
  onValueChange: (value: boolean) => void;
};

export function HomeVisibilityPreference({ value, onValueChange }: HomeVisibilityPreferenceProps) {
  const colors = Colors[useColorScheme() ?? 'light'];

  return (
    <View style={[styles.card, { borderColor: colors.border, backgroundColor: colors.surface }]}>
      <View style={styles.copy}>
        <ThemedText type="defaultSemiBold">{t('homeVisibility.title')}</ThemedText>
        <ThemedText style={[styles.hint, { color: colors.textSecondary }]}>
          {t('homeVisibility.hint')}
        </ThemedText>
      </View>
      <Switch
        accessibilityLabel={t('homeVisibility.title')}
        onValueChange={onValueChange}
        trackColor={{ false: colors.border, true: colors.primary }}
        thumbColor={value ? colors.surface : colors.icon}
        value={value}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    minHeight: 72,
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  copy: { minWidth: 0, flex: 1, gap: 3 },
  hint: { fontSize: 12, lineHeight: 17 },
});
