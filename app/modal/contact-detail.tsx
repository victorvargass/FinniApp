import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect, useLocalSearchParams, useNavigation } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { OverflowMenu } from '@/components/overflow-menu';
import { Colors } from '@/constants/theme';
import { useOrganizerDatabase } from '@/contexts/DatabaseDomainContexts';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Alert } from '@/lib/alert';
import { errorMessage, showFeedback } from '@/lib/feedback';
import { t } from '@/lib/i18n';
import type { Contact } from '@/lib/types';

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailRow}>
      <ThemedText style={styles.label}>{label}</ThemedText>
      <ThemedText style={styles.value} selectable>{value}</ThemedText>
    </View>
  );
}

export default function ContactDetailScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const contactId = Number(id);
  const navigation = useNavigation();
  const colors = Colors[useColorScheme() ?? 'light'];
  const { getContact, removeContact } = useOrganizerDatabase();
  const [contact, setContact] = useState<Contact | null>(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);

  const load = useCallback(async () => {
    if (!Number.isInteger(contactId)) {
      setContact(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setContact(await getContact(contactId));
    setLoading(false);
  }, [contactId, getContact]);

  useFocusEffect(useCallback(() => {
    load().catch(() => {
      setContact(null);
      setLoading(false);
    });
  }, [load]));

  const editContact = useCallback(() => {
    if (!contact) return;
    router.push({ pathname: '/modal/contact-form', params: { id: String(contact.id) } } as never);
  }, [contact]);

  const deleteContact = useCallback(() => {
    if (!contact) return;
    Alert.alert(t('contacts.delete'), t('contacts.deleteHint'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: async () => {
          setWorking(true);
          try {
            await removeContact(contact.id);
            showFeedback(t('contacts.deleted'));
            router.back();
          } catch (error) {
            Alert.alert(t('errors.couldNotDelete'), errorMessage(error));
          } finally {
            setWorking(false);
          }
        },
      },
    ]);
  }, [contact, removeContact]);

  useEffect(() => {
    navigation.setOptions({
      title: t('contacts.detail'),
      headerRight: () => (
        <OverflowMenu
          accessibilityLabel={t('common.moreOptions')}
          actions={contact ? [
            { label: t('common.edit'), icon: 'create-outline', onPress: editContact },
            { label: t('common.delete'), icon: 'trash-outline', destructive: true, onPress: deleteContact },
          ] : []}
          disabled={!contact || working}
          iconColor={colors.primary}
        />
      ),
    });
  }, [colors.primary, contact, deleteContact, editContact, navigation, working]);

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={['bottom']}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
          <ThemedText>{t('common.loading')}</ThemedText>
        </View>
      </SafeAreaView>
    );
  }

  if (!contact) {
    return (
      <SafeAreaView style={styles.safe} edges={['bottom']}>
        <View style={styles.center}>
          <Ionicons name="person-outline" size={42} color={colors.icon} />
          <ThemedText type="subtitle">{t('contacts.notFound')}</ThemedText>
        </View>
      </SafeAreaView>
    );
  }

  const accent = contact.relationshipTypeColor ?? colors.primary;
  const hasPersonalInformation = Boolean(
    contact.nickname || contact.relationshipTypeName || contact.email || contact.phone || contact.notes
  );

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
        <ThemedView style={[styles.hero, { borderTopColor: accent }]}>
          <View style={[styles.avatar, { backgroundColor: accent }]}>
            <ThemedText style={styles.avatarText}>{contact.name.trim().charAt(0).toUpperCase()}</ThemedText>
          </View>
          <ThemedText type="title" style={styles.name}>{contact.name}</ThemedText>
          {(contact.nickname || contact.relationshipTypeName) ? (
            <ThemedText style={[styles.secondary, { color: colors.textSecondary }]}>
              {[contact.nickname, contact.relationshipTypeName].filter(Boolean).join(' · ')}
            </ThemedText>
          ) : null}
        </ThemedView>

        <ThemedView style={styles.card}>
          <ThemedText type="subtitle">{t('contacts.personalInformation')}</ThemedText>
          {contact.nickname ? <DetailRow label={t('contacts.nicknameLabel')} value={contact.nickname} /> : null}
          {contact.relationshipTypeName ? <DetailRow label={t('contacts.relationshipLabel')} value={contact.relationshipTypeName} /> : null}
          {contact.email ? <DetailRow label={t('contacts.emailLabel')} value={contact.email} /> : null}
          {contact.phone ? <DetailRow label={t('contacts.phoneLabel')} value={contact.phone} /> : null}
          {contact.notes ? <DetailRow label={t('contacts.notesLabel')} value={contact.notes} /> : null}
          {!hasPersonalInformation ? (
            <ThemedText style={[styles.emptyText, { color: colors.textSecondary }]}>{t('contacts.noAdditionalInformation')}</ThemedText>
          ) : null}
        </ThemedView>

        <View style={styles.sectionTitle}>
          <ThemedText type="subtitle">{t('contacts.bankAccounts')}</ThemedText>
          <ThemedText style={[styles.count, { color: colors.textSecondary }]}>{contact.bankAccounts.length}</ThemedText>
        </View>
        {contact.bankAccounts.length === 0 ? (
          <ThemedView style={[styles.emptyCard, { borderColor: colors.border }]}>
            <Ionicons name="wallet-outline" size={28} color={colors.icon} />
            <ThemedText style={{ color: colors.textSecondary }}>{t('contacts.noBankAccounts')}</ThemedText>
          </ThemedView>
        ) : contact.bankAccounts.map((account, index) => (
          <ThemedView key={account.id} style={styles.card}>
            <View style={styles.accountHeading}>
              <View style={[styles.accountIcon, { backgroundColor: `${accent}18` }]}>
                <Ionicons name="card-outline" size={21} color={accent} />
              </View>
              <View style={styles.accountTitle}>
                <ThemedText type="defaultSemiBold">{account.bankName}</ThemedText>
                <ThemedText style={[styles.secondary, { color: colors.textSecondary }]}>
                  {t('contacts.bankAccountNumber', { number: index + 1 })}
                </ThemedText>
              </View>
            </View>
            <DetailRow label={t('contacts.accountType')} value={account.accountType} />
            <DetailRow label={t('contacts.accountNumber')} value={account.accountNumber} />
            {account.holderName ? <DetailRow label={t('contacts.accountHolderLabel')} value={account.holderName} /> : null}
            {account.rut ? <DetailRow label={t('contacts.rutLabel')} value={account.rut} /> : null}
            {account.email ? <DetailRow label={t('contacts.transferEmailLabel')} value={account.email} /> : null}
          </ThemedView>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { padding: 20, paddingBottom: 40, gap: 16 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24 },
  hero: { borderRadius: 18, borderTopWidth: 5, alignItems: 'center', padding: 24, gap: 8 },
  avatar: { width: 68, height: 68, borderRadius: 34, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#FFFFFF', fontSize: 27, fontWeight: '800' },
  name: { textAlign: 'center' },
  secondary: { fontSize: 13, lineHeight: 18 },
  card: { borderRadius: 18, padding: 20, gap: 4 },
  detailRow: { paddingVertical: 11, gap: 4, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#AEBBC755' },
  label: { opacity: 0.65, fontSize: 13 },
  value: { fontSize: 16, fontWeight: '600' },
  emptyText: { paddingVertical: 16, lineHeight: 20 },
  sectionTitle: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 2 },
  count: { fontSize: 13, fontWeight: '700' },
  emptyCard: { minHeight: 110, borderWidth: 1, borderRadius: 16, alignItems: 'center', justifyContent: 'center', gap: 8 },
  accountHeading: { flexDirection: 'row', alignItems: 'center', gap: 11, marginBottom: 4 },
  accountIcon: { width: 42, height: 42, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  accountTitle: { flex: 1, gap: 2 },
});
