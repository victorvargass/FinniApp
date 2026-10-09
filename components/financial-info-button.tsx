import { Ionicons } from '@expo/vector-icons';
import type { GestureResponderEvent, StyleProp, ViewStyle } from 'react-native';
import { Pressable, StyleSheet } from 'react-native';

import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { t } from '@/lib/i18n';

export function FinancialInfoButton({
  onPress,
  color,
  style,
}: {
  onPress: () => void;
  color?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const colors = Colors[useColorScheme() ?? 'light'];
  const handlePress = (event: GestureResponderEvent) => {
    event.stopPropagation();
    onPress();
  };
  return (
    <Pressable
      accessibilityLabel={t('financialExplanation.open')}
      accessibilityRole="button"
      hitSlop={7}
      onPress={handlePress}
      style={({ pressed }) => [styles.button, style, pressed && styles.pressed]}>
      <Ionicons name="bulb-outline" size={15} color={color ?? colors.action} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: { width: 25, height: 25, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.5 },
});
