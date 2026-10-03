import { useWindowDimensions } from 'react-native';

import { AccessibilityTokens } from '@/constants/theme';

export function useLargeTextLayout(): boolean {
  const { fontScale } = useWindowDimensions();
  return fontScale >= AccessibilityTokens.largeTextScale;
}
