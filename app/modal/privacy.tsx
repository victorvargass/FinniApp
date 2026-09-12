import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { t } from '@/lib/i18n';

const SECTIONS = [
  ['privacy.localTitle', 'privacy.localBody'],
  ['privacy.accountsTitle', 'privacy.accountsBody'],
  ['privacy.googleTitle', 'privacy.googleBody'],
  ['privacy.permissionsTitle', 'privacy.permissionsBody'],
  ['privacy.reportsTitle', 'privacy.reportsBody'],
  ['privacy.deletionTitle', 'privacy.deletionBody'],
  ['privacy.securityTitle', 'privacy.securityBody'],
] as const;

export default function PrivacyScreen() {
  const colors = Colors[useColorScheme() ?? 'light'];
  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
        <ThemedText style={styles.updated}>{t('privacy.updated')}</ThemedText>
        <ThemedText style={styles.intro}>{t('privacy.intro')}</ThemedText>
        {SECTIONS.map(([title, body]) => (
          <ThemedView key={title} style={[styles.card, { borderColor: colors.border }]}>
            <ThemedText type="subtitle">{t(title)}</ThemedText>
            <ThemedText style={styles.body}>{t(body)}</ThemedText>
          </ThemedView>
        ))}
        <View style={styles.contact}>
          <ThemedText type="defaultSemiBold">{t('privacy.contactTitle')}</ThemedText>
          <ThemedText selectable>victorvargassandoval93@gmail.com</ThemedText>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { padding: 20, paddingBottom: 44, gap: 14 },
  updated: { opacity: 0.58 },
  intro: { lineHeight: 22 },
  card: { borderWidth: 1, borderRadius: 16, padding: 16, gap: 8 },
  body: { lineHeight: 21, opacity: 0.82 },
  contact: { alignItems: 'center', gap: 6, paddingTop: 8 },
});
