import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Colors, Fonts } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { t } from '@/lib/i18n';
import { ThemedText } from './themed-text';

export type FeatureGuideKey =
  | 'payment-methods'
  | 'savings'
  | 'debts'
  | 'recurrences'
  | 'google-drive';

export type FeatureGuideSlide = {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  body: string;
};

const GUIDE_STORAGE_PREFIX = '@finniapp/feature-guide-v1/';

export function useFeatureGuide(key: FeatureGuideKey) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let active = true;
    AsyncStorage.getItem(`${GUIDE_STORAGE_PREFIX}${key}`)
      .then((value) => {
        if (active && value !== 'true') setVisible(true);
      })
      .catch(() => undefined);
    return () => { active = false; };
  }, [key]);

  const close = async () => {
    setVisible(false);
    await AsyncStorage.setItem(`${GUIDE_STORAGE_PREFIX}${key}`, 'true');
  };

  return {
    visible,
    open: () => setVisible(true),
    close,
  };
}

export function FeatureGuideButton({ onPress }: { onPress: () => void }) {
  const colors = Colors[useColorScheme() ?? 'light'];
  return (
    <Pressable
      accessibilityLabel={t('featureGuides.openHelp')}
      accessibilityRole="button"
      hitSlop={8}
      onPress={onPress}
      style={({ pressed }) => [
        styles.helpButton,
        { borderColor: colors.border, backgroundColor: colors.surface },
        pressed && styles.pressed,
      ]}>
      <Ionicons name="help-circle-outline" size={22} color={colors.action} />
    </Pressable>
  );
}

type FeatureGuideProps = {
  visible: boolean;
  slides: FeatureGuideSlide[];
  onClose: () => void | Promise<void>;
};

export function FeatureGuide({ visible, slides, onClose }: FeatureGuideProps) {
  const colors = Colors[useColorScheme() ?? 'light'];
  const [page, setPage] = useState(0);
  const lastPage = page === slides.length - 1;
  const slide = slides[page];

  useEffect(() => {
    if (visible) setPage(0);
  }, [visible]);

  if (!slide) return null;

  return (
    <Modal
      animationType="fade"
      onRequestClose={() => { void onClose(); }}
      statusBarTranslucent
      transparent
      visible={visible}>
      <SafeAreaView style={styles.overlay}>
        <View style={[styles.card, { backgroundColor: colors.surfaceRaised }]}>
          <View style={styles.topRow}>
            <ThemedText style={styles.step}>
              {t('featureGuides.step', { current: page + 1, total: slides.length })}
            </ThemedText>
            <Pressable
              accessibilityLabel={t('common.close')}
              accessibilityRole="button"
              hitSlop={10}
              onPress={() => { void onClose(); }}>
              <Ionicons name="close" size={24} color={colors.icon} />
            </Pressable>
          </View>

          <View style={[styles.icon, { backgroundColor: `${colors.secondary}22` }]}>
            <Ionicons name={slide.icon} size={40} color={colors.action} />
          </View>
          <ThemedText type="title" style={styles.title}>{slide.title}</ThemedText>
          <ThemedText style={[styles.body, { color: colors.textSecondary }]}>{slide.body}</ThemedText>

          <View style={styles.dots}>
            {slides.map((_, index) => (
              <View
                key={index}
                style={[
                  styles.dot,
                  { backgroundColor: index === page ? colors.secondary : colors.border },
                  index === page && styles.activeDot,
                ]}
              />
            ))}
          </View>

          <View style={styles.actions}>
            {page > 0 && (
              <Pressable
                accessibilityRole="button"
                onPress={() => setPage((current) => current - 1)}
                style={[styles.backButton, { borderColor: colors.border }]}>
                <Ionicons name="arrow-back" size={20} color={colors.text} />
              </Pressable>
            )}
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                if (lastPage) void onClose();
                else setPage((current) => current + 1);
              }}
              style={[styles.nextButton, { backgroundColor: colors.secondary }]}>
              <ThemedText style={[styles.nextText, { color: colors.onSecondary }]}>
                {t(lastPage ? 'featureGuides.understood' : 'onboarding.next')}
              </ThemedText>
              <Ionicons
                name={lastPage ? 'checkmark' : 'arrow-forward'}
                size={20}
                color={colors.onSecondary}
              />
            </Pressable>
          </View>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    padding: 16,
    backgroundColor: '#00182BCC',
  },
  card: {
    minHeight: 430,
    borderRadius: 24,
    padding: 22,
    gap: 16,
    shadowColor: '#000',
    shadowOpacity: 0.24,
    shadowRadius: 18,
    elevation: 12,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  step: {
    fontFamily: Fonts.semiBold,
    fontSize: 13,
    opacity: 0.62,
  },
  icon: {
    width: 76,
    height: 76,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
  },
  title: {
    fontSize: 25,
    lineHeight: 31,
  },
  body: {
    flex: 1,
    fontSize: 16,
    lineHeight: 24,
  },
  dots: {
    minHeight: 12,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 7,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  activeDot: {
    width: 24,
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
  },
  backButton: {
    width: 52,
    minHeight: 52,
    borderWidth: 1,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nextButton: {
    flex: 1,
    minHeight: 52,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
    paddingHorizontal: 18,
  },
  nextText: {
    fontFamily: Fonts.bold,
  },
  helpButton: {
    width: 40,
    height: 40,
    borderWidth: 1,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.68,
  },
});
