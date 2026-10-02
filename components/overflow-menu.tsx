import { Ionicons } from '@expo/vector-icons';
import { useRef, useState } from 'react';
import { Modal, Pressable, StyleProp, StyleSheet, Switch, useWindowDimensions, View, ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

export type OverflowMenuAction = {
  label: string;
  icon?: keyof typeof Ionicons.glyphMap;
  onPress?: () => void;
  destructive?: boolean;
  disabled?: boolean;
  switchValue?: boolean;
  onSwitchValueChange?: (value: boolean) => void;
};

type Anchor = { x: number; y: number; width: number; height: number };

export function OverflowMenu({
  accessibilityLabel,
  actions,
  disabled = false,
  iconColor,
  iconSize = 24,
  buttonStyle,
  testID,
}: {
  accessibilityLabel: string;
  actions: OverflowMenuAction[];
  disabled?: boolean;
  iconColor?: string;
  iconSize?: number;
  buttonStyle?: StyleProp<ViewStyle>;
  testID?: string;
}) {
  const colors = Colors[useColorScheme() ?? 'light'];
  const { width: windowWidth } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const anchorRef = useRef<View>(null);
  const [anchor, setAnchor] = useState<Anchor | null>(null);
  const visible = anchor != null;

  const close = () => setAnchor(null);
  const open = () => {
    anchorRef.current?.measureInWindow((x, y, width, height) => {
      setAnchor({ x, y, width, height });
    });
  };
  const menuWidth = Math.min(260, windowWidth - 24);
  const menuLeft = anchor
    ? Math.min(Math.max(12, anchor.x + anchor.width - menuWidth), windowWidth - menuWidth - 12)
    : 12;
  const menuTop = Math.max(
    (anchor?.y ?? 0) + (anchor?.height ?? 0) + 4,
    insets.top + 56 + 4
  );

  return (
    <>
      <Pressable
        ref={anchorRef}
        accessibilityLabel={accessibilityLabel}
        accessibilityRole="button"
        accessibilityState={{ disabled, expanded: visible }}
        disabled={disabled}
        hitSlop={8}
        onPress={open}
        style={({ pressed }) => [styles.trigger, buttonStyle, pressed && styles.pressed, disabled && styles.disabled]}
        testID={testID}>
        <Ionicons name="ellipsis-vertical" size={iconSize} color={iconColor ?? colors.primary} />
      </Pressable>
      <Modal
        animationType="fade"
        onRequestClose={close}
        statusBarTranslucent
        transparent
        visible={visible}>
        <Pressable accessible={false} onPress={close} style={styles.overlay}>
          <ThemedView
            accessibilityViewIsModal
            style={[
              styles.menu,
              {
                backgroundColor: colors.surfaceRaised,
                borderColor: colors.border,
                left: menuLeft,
                top: menuTop,
                width: menuWidth,
              },
            ]}>
            {actions.map((action, index) => {
              const isSwitch = action.switchValue != null && action.onSwitchValueChange != null;
              const toggleSwitch = () => action.onSwitchValueChange?.(!action.switchValue);
              return (
                <Pressable
                  accessibilityRole={isSwitch ? 'switch' : 'menuitem'}
                  accessibilityState={{ disabled: action.disabled, ...(isSwitch ? { checked: action.switchValue } : {}) }}
                  disabled={action.disabled}
                  key={`${action.label}-${index}`}
                  onPress={() => {
                    if (isSwitch) {
                      toggleSwitch();
                      return;
                    }
                    close();
                    if (action.onPress) requestAnimationFrame(action.onPress);
                  }}
                  style={({ pressed }) => [
                    styles.item,
                    index > 0 && { borderTopColor: colors.border, borderTopWidth: StyleSheet.hairlineWidth },
                    pressed && styles.pressed,
                    action.disabled && styles.disabled,
                  ]}>
                  {action.icon && (
                    <Ionicons
                      name={action.icon}
                      size={20}
                      color={action.destructive ? colors.expense : colors.icon}
                    />
                  )}
                  <ThemedText
                    type="defaultSemiBold"
                    style={[styles.label, action.destructive && { color: colors.expense }]}>
                    {action.label}
                  </ThemedText>
                  {isSwitch && (
                    <Switch
                      accessibilityLabel={action.label}
                      disabled={action.disabled}
                      onValueChange={action.onSwitchValueChange}
                      pointerEvents="none"
                      trackColor={{ false: colors.border, true: colors.primary }}
                      thumbColor={action.switchValue ? colors.surface : colors.icon}
                      value={action.switchValue}
                    />
                  )}
                </Pressable>
              );
            })}
          </ThemedView>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  trigger: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  overlay: { flex: 1 },
  menu: {
    position: 'absolute',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 8,
  },
  item: { minHeight: 48, paddingHorizontal: 15, flexDirection: 'row', alignItems: 'center', gap: 11 },
  label: { flex: 1 },
  pressed: { opacity: 0.68 },
  disabled: { opacity: 0.45 },
});
