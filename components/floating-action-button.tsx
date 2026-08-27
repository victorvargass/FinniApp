import { Ionicons } from '@expo/vector-icons';
import { Href, router } from 'expo-router';
import { Pressable, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

type FloatingActionButtonProps = {
  href: Href;
  accessibilityLabel: string;
  avoidBottomInset?: boolean;
};

export function FloatingActionButton({
  href,
  accessibilityLabel,
  avoidBottomInset = false,
}: FloatingActionButtonProps) {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];
  const insets = useSafeAreaInsets();

  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      hitSlop={8}
      onPress={() => router.push(href)}
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor: colors.primary,
          bottom: avoidBottomInset ? Math.max(insets.bottom, 16) + 20 : 20,
        },
        pressed && styles.pressed,
      ]}
    >
      <Ionicons name="add" size={32} color={colors.onPrimary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    position: 'absolute',
    right: 20,
    width: 58,
    height: 58,
    zIndex: 100,
    borderRadius: 29,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 5,
  },
  pressed: {
    opacity: 0.8,
    transform: [{ scale: 0.96 }],
  },
});
