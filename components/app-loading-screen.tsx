import { Image } from 'expo-image';
import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { t } from '@/lib/i18n';
import { BrandColors } from '@/constants/theme';

const loadingIllustration = require('@/assets/images/brand-mark-safe.png');
const wordmark = require('@/assets/images/splash-icon-dark.png');

export function AppLoadingScreen() {
  const pulse = useRef(new Animated.Value(0)).current;
  const insets = useSafeAreaInsets();

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 850,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 850,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );

    animation.start();
    return () => animation.stop();
  }, [pulse]);

  return (
    <View
      accessibilityLabel={t('startup.loading')}
      accessibilityRole="progressbar"
      style={[
        styles.container,
        {
          paddingTop: Math.max(insets.top, 24),
          paddingBottom: Math.max(insets.bottom, 24),
        },
      ]}
    >
      <View style={styles.brandBlock}>
        <Animated.View
          style={{
            opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1] }),
            transform: [
              { scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.985, 1.015] }) },
            ],
          }}
        >
          <Image contentFit="contain" source={loadingIllustration} style={styles.illustration} />
        </Animated.View>

        <Image contentFit="contain" source={wordmark} style={styles.wordmark} />
        <ThemedText
          adjustsFontSizeToFit
          minimumFontScale={0.85}
          numberOfLines={1}
          style={styles.tagline}
        >
          {t('startup.tagline')}
        </ThemedText>

        <View style={styles.loadingDetails}>
          <ThemedText
            adjustsFontSizeToFit
            minimumFontScale={0.85}
            numberOfLines={1}
            style={styles.message}
          >
            {t('startup.loading')}
          </ThemedText>
          <View style={styles.track}>
            <Animated.View
              style={[
                styles.progress,
                {
                  opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.55, 1] }),
                  transform: [
                    { scaleX: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1] }) },
                  ],
                },
              ]}
            />
          </View>
        </View>
      </View>

      <ThemedText
        numberOfLines={2}
        style={[styles.slogan, { bottom: Math.max(insets.bottom, 16) }]}
      >
        “{t('startup.slogan')}”
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    backgroundColor: BrandColors.navy,
  },
  brandBlock: {
    width: '100%',
    maxWidth: 360,
    alignItems: 'center',
    transform: [{ translateY: -28 }],
  },
  illustration: {
    width: 240,
    height: 240,
  },
  wordmark: {
    width: 210,
    height: 47,
    marginTop: -44,
  },
  tagline: {
    width: '100%',
    flexShrink: 0,
    marginTop: 8,
    color: BrandColors.turquoise,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
    textAlign: 'center',
  },
  loadingDetails: {
    width: '100%',
    alignItems: 'center',
    marginTop: 30,
  },
  message: {
    width: '100%',
    flexShrink: 0,
    color: BrandColors.warmWhite,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  track: {
    width: 112,
    height: 4,
    borderRadius: 2,
    marginTop: 14,
    overflow: 'hidden',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  progress: {
    width: '100%',
    height: '100%',
    borderRadius: 2,
    backgroundColor: BrandColors.turquoise,
  },
  slogan: {
    position: 'absolute',
    left: 24,
    right: 24,
    flexShrink: 0,
    color: BrandColors.turquoiseLight,
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
  },
});
