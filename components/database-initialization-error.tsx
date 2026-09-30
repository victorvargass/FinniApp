import { Pressable, StyleSheet, View } from 'react-native';

import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { t } from '@/lib/i18n';
import { ThemedText } from '@/components/themed-text';

type DatabaseInitializationErrorProps = {
  onRetry: () => void;
};

export function DatabaseInitializationError({
  onRetry,
}: DatabaseInitializationErrorProps) {
  const colors = Colors[useColorScheme() ?? 'light'];

  return (
    <View style={[styles.screen, { backgroundColor: colors.screen }]}>
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <ThemedText type="subtitle" style={styles.title}>
          {t('startup.databaseErrorTitle')}
        </ThemedText>
        <ThemedText style={[styles.description, { color: colors.textSecondary }]}>
          {t('startup.databaseErrorDescription')}
        </ThemedText>
        <Pressable
          accessibilityRole="button"
          onPress={onRetry}
          style={({ pressed }) => [
            styles.button,
            { backgroundColor: colors.primary },
            pressed && styles.pressed,
          ]}
        >
          <ThemedText style={[styles.buttonText, { color: colors.onPrimary }]}>
            {t('common.retry')}
          </ThemedText>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 24,
    gap: 14,
  },
  title: {
    textAlign: 'center',
  },
  description: {
    textAlign: 'center',
  },
  button: {
    minHeight: 50,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
    paddingHorizontal: 18,
  },
  buttonText: {
    fontWeight: '700',
  },
  pressed: {
    opacity: 0.75,
  },
});
