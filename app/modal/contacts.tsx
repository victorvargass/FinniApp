import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FloatingActionButton } from '@/components/floating-action-button';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors } from '@/constants/theme';
import { useDatabase } from '@/contexts/DatabaseContext';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { t } from '@/lib/i18n';

export default function ContactsScreen() {
  const { contacts, relationshipTypes } = useDatabase();
  const colors = Colors[useColorScheme() ?? 'light'];

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.screen }]} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
        <ThemedText style={[styles.intro, { color: colors.textSecondary }]}>{t('contacts.intro')}</ThemedText>
        <View style={styles.headingRow}>
          <ThemedText type="subtitle">{t('contacts.title')}</ThemedText>
        </View>
        {contacts.length === 0 && (
          <ThemedView style={[styles.empty, { borderColor: colors.border }]}>
            <Ionicons name="people-outline" size={30} color={colors.icon} />
            <ThemedText>{t('contacts.empty')}</ThemedText>
          </ThemedView>
        )}
        {contacts.map((contact) => (
          <Pressable key={contact.id} onPress={() => router.push({ pathname: '/modal/contact-form' as never, params: { id: String(contact.id) } })}>
            <ThemedView style={[styles.row, { borderColor: colors.border }]}>
              <View style={[styles.avatar, { backgroundColor: contact.relationshipTypeColor ?? colors.primary }]}>
                <ThemedText style={styles.avatarText}>{contact.name.trim().charAt(0).toUpperCase()}</ThemedText>
              </View>
              <View style={styles.copy}>
                <ThemedText type="defaultSemiBold">{contact.name}</ThemedText>
                <ThemedText style={[styles.secondary, { color: colors.textSecondary }]}>
                  {[contact.nickname, contact.relationshipTypeName].filter(Boolean).join(' · ') || t('common.notSpecified')}
                </ThemedText>
              </View>
              <Ionicons name="chevron-forward" size={21} color={colors.icon} />
            </ThemedView>
          </Pressable>
        ))}

        <View style={[styles.headingRow, styles.relationshipHeading]}>
          <View style={styles.copy}>
            <ThemedText type="subtitle">{t('contacts.relationships')}</ThemedText>
            <ThemedText style={[styles.secondary, { color: colors.textSecondary }]}>{t('contacts.relationshipsHint')}</ThemedText>
          </View>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push({ pathname: '/modal/organizer-form', params: { kind: 'relationship' } })}
            style={[styles.addSmall, { borderColor: colors.border }]}>
            <Ionicons name="add" size={20} color={colors.primary} />
          </Pressable>
        </View>
        {relationshipTypes.map((relationship) => (
          <Pressable key={relationship.id} onPress={() => router.push({ pathname: '/modal/organizer-form', params: { kind: 'relationship', id: String(relationship.id) } })}>
            <ThemedView style={[styles.relationshipRow, { borderColor: colors.border }]}>
              <View style={[styles.dot, { backgroundColor: relationship.color }]} />
              <ThemedText style={styles.copy}>{relationship.name}</ThemedText>
              <Ionicons name="create-outline" size={20} color={colors.icon} />
            </ThemedView>
          </Pressable>
        ))}
      </ScrollView>
      <FloatingActionButton accessibilityLabel={t('contacts.new')} avoidBottomInset href={'/modal/contact-form' as never} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 }, content: { padding: 20, paddingBottom: 110, gap: 10 }, intro: { lineHeight: 21, marginBottom: 4 },
  headingRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 4, marginBottom: 2 },
  relationshipHeading: { marginTop: 18 }, copy: { flex: 1, gap: 3 }, secondary: { fontSize: 13, lineHeight: 18 },
  row: { minHeight: 72, borderWidth: 1, borderRadius: 12, padding: 13, flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' }, avatarText: { color: '#fff', fontWeight: '800' },
  empty: { minHeight: 112, borderWidth: 1, borderRadius: 12, alignItems: 'center', justifyContent: 'center', gap: 8 },
  addSmall: { width: 40, height: 40, borderWidth: 1, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  relationshipRow: { minHeight: 54, borderWidth: 1, borderRadius: 11, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 11 },
  dot: { width: 15, height: 15, borderRadius: 5 },
});
