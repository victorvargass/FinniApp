import { StyleSheet, Text, type TextProps, type TextStyle } from 'react-native';

import { useThemeColor } from '@/hooks/use-theme-color';
import { Colors, Fonts } from '@/constants/theme';

export type ThemedTextProps = TextProps & {
  lightColor?: string;
  darkColor?: string;
  type?: 'default' | 'title' | 'defaultSemiBold' | 'subtitle' | 'link';
};

export function ThemedText({
  style,
  lightColor,
  darkColor,
  type = 'default',
  ...rest
}: ThemedTextProps) {
  const color = useThemeColor({ light: lightColor, dark: darkColor }, 'text');
  const flattenedStyle = StyleSheet.flatten(style);
  const requestedWeight = flattenedStyle?.fontWeight;
  const hasCustomFont = Boolean(flattenedStyle?.fontFamily);
  const requestedFontFamily = hasCustomFont ? undefined : getQuicksandFamily(requestedWeight);

  return (
    <Text
      style={[
        { color },
        type === 'default' ? styles.default : undefined,
        type === 'title' ? styles.title : undefined,
        type === 'defaultSemiBold' ? styles.defaultSemiBold : undefined,
        type === 'subtitle' ? styles.subtitle : undefined,
        type === 'link' ? styles.link : undefined,
        style,
        requestedFontFamily ? { fontFamily: requestedFontFamily, fontWeight: undefined } : undefined,
      ]}
      {...rest}
    />
  );
}

function getQuicksandFamily(weight: TextStyle['fontWeight']) {
  if (weight === 'bold' || Number(weight) >= 700) return Fonts.bold;
  if (Number(weight) >= 600) return Fonts.semiBold;
  if (Number(weight) >= 500) return Fonts.medium;
  return undefined;
}

const styles = StyleSheet.create({
  default: {
    fontFamily: Fonts.regular,
    fontSize: 16,
    lineHeight: 24,
  },
  defaultSemiBold: {
    fontFamily: Fonts.semiBold,
    fontSize: 16,
    lineHeight: 24,
  },
  title: {
    fontFamily: Fonts.bold,
    fontSize: 28,
    lineHeight: 32,
  },
  subtitle: {
    fontFamily: Fonts.bold,
    fontSize: 20,
  },
  link: {
    fontFamily: Fonts.semiBold,
    lineHeight: 30,
    fontSize: 16,
    color: Colors.light.action,
  },
});
