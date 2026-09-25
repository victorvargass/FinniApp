import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FeatureGuide, FeatureGuideButton, useFeatureGuide } from '@/components/feature-guide';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { t } from '@/lib/i18n';

export default function GroupingsScreen() {
  const colors = Colors[useColorScheme() ?? 'light'];
  const guide = useFeatureGuide('groupings');
  const guideSlides = [
    {
      icon: 'grid-outline' as const,
      title: t('featureGuides.groupings.organizeTitle'),
      body: t('featureGuides.groupings.organizeBody'),
    },
    {
      icon: 'pricetags-outline' as const,
      title: t('featureGuides.groupings.categoriesTitle'),
      body: t('featureGuides.groupings.categoriesBody'),
    },
    {
      icon: 'layers-outline' as const,
      title: t('featureGuides.groupings.savingsTitle'),
      body: t('featureGuides.groupings.savingsBody'),
    },
    {
      icon: 'shield-checkmark-outline' as const,
      title: t('featureGuides.groupings.optionalTitle'),
      body: t('featureGuides.groupings.optionalBody'),
    },
  ];
  const sections = [
    { title: t('navigation.categories'), description: t('groupings.categoriesDescription'), route: '/modal/categories' as const, icon: 'pricetags-outline' as const },
    { title: t('navigation.savingsGroups'), description: t('groupings.savingsGroupsDescription'), route: '/modal/savings-groups' as const, icon: 'layers-outline' as const },
    { title: t('navigation.contacts'), description: t('groupings.contactsDescription'), route: '/modal/contacts' as const, icon: 'people-outline' as const },
  ];

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.screen }]} edges={['bottom']}>
      <View style={styles.content}>
        <View style={styles.guideHeader}>
          <ThemedText style={[styles.intro, { color: colors.textSecondary }]}>
            {t('groupings.intro')}
          </ThemedText>
          <FeatureGuideButton onPress={guide.open} />
        </View>
        {sections.map((section) => (
          <Pressable
            key={section.route}
            accessibilityRole="button"
            onPress={() => router.push(section.route as never)}
            style={({ pressed }) => pressed && styles.pressed}>
            <ThemedView style={[styles.card, { borderColor: colors.border }]}>
              <Ionicons name={section.icon} size={25} color={colors.tint} />
              <View style={styles.copy}>
                <ThemedText type="subtitle">{section.title}</ThemedText>
                <ThemedText style={[styles.description, { color: colors.textSecondary }]}>{section.description}</ThemedText>
              </View>
              <Ionicons name="chevron-forward" size={21} color={colors.icon} />
            </ThemedView>
          </Pressable>
        ))}
      </View>
      <FeatureGuide visible={guide.visible} slides={guideSlides} onClose={guide.close} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { padding: 20, gap: 12 },
  guideHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 2 },
  intro: { flex: 1, lineHeight: 21 },
  card: { minHeight: 92, borderWidth: 1, borderRadius: 13, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 14 },
  copy: { flex: 1, gap: 4 },
  description: { fontSize: 13, lineHeight: 18 },
  pressed: { opacity: 0.7 },
});
