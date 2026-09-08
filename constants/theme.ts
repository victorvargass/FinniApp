import { Platform } from 'react-native';

export const BrandColors = {
  navy: '#0B315B',
  turquoise: '#20C9B5',
  turquoiseLight: '#48D9C2',
  chartBlue: '#20B9DB',
  blueSecondary: '#174A73',
  warmWhite: '#FAF8F4',
  blueGray: '#60758E',
  gradientStart: '#42D6C0',
  gradientEnd: '#0799A4',
} as const;

export const SemanticColors = {
  income: '#1FAF78',
  expense: '#E95353',
  savings: BrandColors.chartBlue,
  warning: '#D88916',
  danger: '#C93F4B',
} as const;

export type ThemePalette = {
  text: string;
  background: string;
  screen: string;
  surface: string;
  surfaceRaised: string;
  border: string;
  textSecondary: string;
  primary: string;
  secondary: string;
  action: string;
  onPrimary: string;
  onSecondary: string;
  tint: string;
  icon: string;
  tabIconDefault: string;
  tabIconSelected: string;
  success: string;
  expense: string;
  savings: string;
  warning: string;
  danger: string;
};

export const Colors: Record<'light' | 'dark', ThemePalette> = {
  light: {
    text: BrandColors.navy,
    background: BrandColors.warmWhite,
    screen: BrandColors.warmWhite,
    surface: '#FFFFFF',
    surfaceRaised: '#FFFFFF',
    border: '#D8E1E8',
    textSecondary: BrandColors.blueGray,
    primary: BrandColors.navy,
    secondary: BrandColors.turquoise,
    action: '#079E91',
    onPrimary: '#FFFFFF',
    onSecondary: BrandColors.navy,
    tint: BrandColors.turquoise,
    icon: BrandColors.blueGray,
    tabIconDefault: BrandColors.blueGray,
    tabIconSelected: BrandColors.turquoise,
    success: SemanticColors.income,
    expense: SemanticColors.expense,
    savings: SemanticColors.savings,
    warning: SemanticColors.warning,
    danger: SemanticColors.danger,
  },
  dark: {
    text: BrandColors.warmWhite,
    background: '#071C31',
    screen: '#061525',
    surface: '#0B2947',
    surfaceRaised: '#10375B',
    border: '#28516F',
    textSecondary: '#A9BBCB',
    primary: BrandColors.turquoiseLight,
    secondary: BrandColors.turquoise,
    action: BrandColors.turquoiseLight,
    onPrimary: BrandColors.navy,
    onSecondary: BrandColors.navy,
    tint: BrandColors.turquoiseLight,
    icon: '#A9BBCB',
    tabIconDefault: '#8FA6B9',
    tabIconSelected: BrandColors.turquoiseLight,
    success: '#43D49C',
    expense: '#FF7474',
    savings: '#4CCDE7',
    warning: '#F2B552',
    danger: '#FF737D',
  },
};

export const Fonts = {
  regular: 'Quicksand_400Regular',
  medium: 'Quicksand_500Medium',
  semiBold: 'Quicksand_600SemiBold',
  bold: 'Quicksand_700Bold',
  sans: 'Quicksand_400Regular',
  rounded: 'Quicksand_500Medium',
  mono: Platform.select({ ios: 'ui-monospace', default: 'monospace' }),
} as const;

export const BrandGradient = [BrandColors.gradientStart, BrandColors.gradientEnd] as const;
export const LayoutTokens = {
  radiusSmall: 10,
  radiusMedium: 12,
  radiusLarge: 16,
  spacing: 4,
} as const;
