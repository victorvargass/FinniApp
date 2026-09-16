import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { t } from '@/lib/i18n';

export default function GroupingsScreen() {
  const colors = Colors[useColorScheme() ?? 'light'];
  const sections = [
    { title: t('navigation.categories'), description: t('groupings.categoriesDescription'), route: '/modal/categories' as const, icon: 'pricetags-outline' as const },
    { title: t('navigation.savingsGroups'), description: t('groupings.savingsGroupsDescription'), route: '/modal/savings-groups' as const, icon: 'layers-outline' as const },
  ];

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.screen }]} edges={['bottom']}>
      <View style={styles.content}>
        {sections.map((section) => (
          <Pressable
            key={section.route}
            accessibilityRole="button"
            onPress={() => router.push(section.route)}
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { padding: 20, gap: 12 },
  card: { minHeight: 92, borderWidth: 1, borderRadius: 13, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 14 },
  copy: { flex: 1, gap: 4 },
  description: { fontSize: 13, lineHeight: 18 },
  pressed: { opacity: 0.7 },
});
