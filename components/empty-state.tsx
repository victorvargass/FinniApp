import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

type EmptyStateProps = {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
};

export function EmptyState({
  icon,
  title,
  description,
  actionLabel,
  onAction,
}: EmptyStateProps) {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];

  return (
    <View style={styles.container}>
      <View style={[styles.iconContainer, { backgroundColor: `${colors.secondary}1F` }]}>
        <Ionicons name={icon} size={30} color={colors.action} />
      </View>
      <ThemedText type="subtitle" style={styles.title}>{title}</ThemedText>
      <ThemedText style={[styles.description, { color: colors.textSecondary }]}>
        {description}
      </ThemedText>
      {actionLabel && onAction ? (
        <Pressable
          style={[styles.action, { backgroundColor: colors.primary }]}
          onPress={onAction}
          accessibilityRole="button">
          <ThemedText style={[styles.actionLabel, { color: colors.onPrimary }]}>
            {actionLabel}
          </ThemedText>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingHorizontal: 28,
    paddingVertical: 40,
    gap: 10,
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  title: {
    textAlign: 'center',
  },
  description: {
    textAlign: 'center',
    lineHeight: 21,
  },
  action: {
    minHeight: 46,
    minWidth: 180,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    marginTop: 8,
  },
  actionLabel: {
    fontWeight: '700',
  },
});
