import { Image } from 'expo-image';
import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { t } from '@/lib/i18n';

const loadingIllustration = require('@/assets/images/brand-mark-safe.png');
const wordmark = require('@/assets/images/splash-icon-dark.png');

export function AppLoadingScreen() {
  const pulse = useRef(new Animated.Value(0)).current;

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
      style={styles.container}
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
        <ThemedText style={styles.tagline}>{t('startup.tagline')}</ThemedText>

        <View style={styles.loadingDetails}>
          <ThemedText style={styles.message}>{t('startup.loading')}</ThemedText>
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

      <ThemedText style={styles.slogan}>“{t('startup.slogan')}”</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    backgroundColor: '#0D3B66',
  },
  brandBlock: {
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
    marginTop: 8,
    color: '#28D7C7',
    fontSize: 14,
    fontWeight: '600',
  },
  loadingDetails: {
    alignItems: 'center',
    marginTop: 30,
  },
  message: {
    color: '#D8E7F3',
    fontSize: 14,
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
    backgroundColor: '#28D7C7',
  },
  slogan: {
    position: 'absolute',
    bottom: 44,
    color: '#B9CFDF',
    fontSize: 12,
    textAlign: 'center',
  },
});
