import { Ionicons } from '@expo/vector-icons';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { SimpleSelect } from '@/components/simple-select';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors, Fonts, LayoutTokens } from '@/constants/theme';
import { useDatabase } from '@/contexts/DatabaseContext';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Alert } from '@/lib/alert';
import { errorMessage, showFeedback } from '@/lib/feedback';
import { t } from '@/lib/i18n';
import type { NewContact } from '@/lib/types';

type AccountDraft = NewContact['bankAccounts'][number];
const emptyAccount = (): AccountDraft => ({ bankName: '', holderName: null, rut: null, accountType: '', accountNumber: '', email: null });

export default function ContactFormScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const contactId = id ? Number(id) : null;
  const { contacts, relationshipTypes, saveContact, removeContact } = useDatabase();
  const contact = contacts.find((item) => item.id === contactId);
  const colors = Colors[useColorScheme() ?? 'light'];
  const [name, setName] = useState('');
  const [nickname, setNickname] = useState('');
  const [relationshipTypeId, setRelationshipTypeId] = useState<number | null>(null);
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [accounts, setAccounts] = useState<AccountDraft[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!contact) return;
    setName(contact.name); setNickname(contact.nickname ?? ''); setRelationshipTypeId(contact.relationshipTypeId);
    setEmail(contact.email ?? ''); setPhone(contact.phone ?? ''); setNotes(contact.notes ?? '');
    setAccounts(contact.bankAccounts.map(({ bankName, holderName, rut, accountType, accountNumber, email: accountEmail }) => ({ bankName, holderName, rut, accountType, accountNumber, email: accountEmail })));
  }, [contact]);

  const updateAccount = (index: number, key: keyof AccountDraft, value: string) => {
    setAccounts((current) => current.map((account, accountIndex) => accountIndex === index ? { ...account, [key]: value || null } : account));
  };

  const save = async () => {
    if (!name.trim()) return Alert.alert(t('common.error'), t('contacts.nameRequired'));
    setSaving(true);
    try {
      await saveContact({
        name: name.trim(), nickname: nickname.trim() || null, relationshipTypeId,
        email: email.trim() || null, phone: phone.trim() || null, notes: notes.trim() || null,
        bankAccounts: accounts,
      }, contactId ?? undefined);
      showFeedback(t(contactId == null ? 'contacts.created' : 'contacts.updated'));
      router.back();
    } catch (error) { Alert.alert(t('errors.couldNotSave'), errorMessage(error)); }
    finally { setSaving(false); }
  };

  const confirmDelete = () => {
    if (contactId == null) return;
    Alert.alert(t('contacts.delete'), t('contacts.deleteHint'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('common.delete'), style: 'destructive', onPress: () => {
        setSaving(true);
        removeContact(contactId).then(() => { showFeedback(t('contacts.deleted')); router.back(); })
          .catch((error) => Alert.alert(t('errors.couldNotDelete'), errorMessage(error))).finally(() => setSaving(false));
      } },
    ]);
  };

  const relationshipOptions = [{ value: null, label: t('common.notSpecified') }, ...relationshipTypes.map((item) => ({ value: item.id, label: item.name, color: item.color }))];
  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <Stack.Screen options={{ title: t(contactId == null ? 'contacts.new' : 'contacts.edit') }} />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <ThemedText style={styles.intro}>{t('contacts.formHint')}</ThemedText>
        <ThemedView style={styles.card}>
          <Field label={t('contacts.name')} value={name} onChangeText={setName} colors={colors} />
          <Field label={t('contacts.nickname')} value={nickname} onChangeText={setNickname} colors={colors} />
          <SimpleSelect searchable label={t('contacts.relationship')} value={relationshipTypeId} onChange={setRelationshipTypeId} options={relationshipOptions} />
          <Field label={t('contacts.email')} value={email} onChangeText={setEmail} colors={colors} keyboardType="email-address" autoCapitalize="none" />
          <Field label={t('contacts.phone')} value={phone} onChangeText={setPhone} colors={colors} keyboardType="phone-pad" />
          <Field label={t('contacts.notes')} value={notes} onChangeText={setNotes} colors={colors} multiline />
        </ThemedView>

        <View style={styles.sectionHeader}><View style={styles.sectionCopy}><ThemedText type="subtitle">{t('contacts.bankAccounts')}</ThemedText><ThemedText style={styles.hint}>{t('contacts.bankAccountsHint')}</ThemedText></View><Pressable onPress={() => setAccounts((current) => [...current, emptyAccount()])} style={[styles.addAccount, { borderColor: colors.border }]}><Ionicons name="add" size={21} color={colors.primary} /></Pressable></View>
        {accounts.map((account, index) => (
          <ThemedView key={index} style={styles.card}>
            <View style={styles.accountTitle}><ThemedText type="defaultSemiBold">{t('contacts.bankAccountNumber', { number: index + 1 })}</ThemedText><Pressable onPress={() => setAccounts((current) => current.filter((_, itemIndex) => itemIndex !== index))}><Ionicons name="trash-outline" size={20} color="#C43E50" /></Pressable></View>
            <Field label={t('contacts.bankName')} value={account.bankName} onChangeText={(value) => updateAccount(index, 'bankName', value)} colors={colors} />
            <Field label={t('contacts.holderName')} value={account.holderName ?? ''} onChangeText={(value) => updateAccount(index, 'holderName', value)} colors={colors} />
            <Field label={t('contacts.rut')} value={account.rut ?? ''} onChangeText={(value) => updateAccount(index, 'rut', value)} colors={colors} autoCapitalize="characters" />
            <Field label={t('contacts.accountType')} value={account.accountType} onChangeText={(value) => updateAccount(index, 'accountType', value)} colors={colors} />
            <Field label={t('contacts.accountNumber')} value={account.accountNumber} onChangeText={(value) => updateAccount(index, 'accountNumber', value)} colors={colors} keyboardType="number-pad" />
            <Field label={t('contacts.transferEmail')} value={account.email ?? ''} onChangeText={(value) => updateAccount(index, 'email', value)} colors={colors} keyboardType="email-address" autoCapitalize="none" />
          </ThemedView>
        ))}
        <Pressable disabled={saving} onPress={() => void save()} style={[styles.primary, saving && styles.disabled]}><ThemedText style={styles.primaryText}>{saving ? t('common.saving') : t('common.save')}</ThemedText></Pressable>
        {contactId != null && <Pressable disabled={saving} onPress={confirmDelete} style={styles.danger}><ThemedText style={styles.dangerText}>{t('contacts.delete')}</ThemedText></Pressable>}
      </ScrollView>
    </SafeAreaView>
  );
}

function Field({ label, colors, ...props }: React.ComponentProps<typeof TextInput> & { label: string; colors: typeof Colors.light }) {
  return <View style={styles.group}><ThemedText style={styles.label}>{label}</ThemedText><TextInput {...props} placeholderTextColor={colors.icon} style={[styles.input, props.multiline && styles.multiline, { borderColor: colors.border, color: colors.text }]} /></View>;
}

const styles = StyleSheet.create({
  safe: { flex: 1 }, content: { padding: 20, paddingBottom: LayoutTokens.formScrollBottom, gap: 15 }, intro: { opacity: 0.68, lineHeight: 20 },
  card: { borderRadius: 13, padding: 16, gap: 14 }, group: { gap: 7 }, label: { fontWeight: '600' }, hint: { opacity: 0.62, fontSize: 12, lineHeight: 17 },
  input: { minHeight: 48, borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, fontSize: 16, fontFamily: Fonts.regular }, multiline: { minHeight: 82, paddingTop: 12, textAlignVertical: 'top' },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 4 }, sectionCopy: { flex: 1, gap: 3 }, addAccount: { width: 42, height: 42, borderWidth: 1, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  accountTitle: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, primary: { minHeight: 52, borderRadius: 11, backgroundColor: '#0B315B', alignItems: 'center', justifyContent: 'center' }, primaryText: { color: '#fff', fontWeight: '700' },
  danger: { minHeight: 50, borderWidth: 1, borderColor: '#C43E50', borderRadius: 11, alignItems: 'center', justifyContent: 'center' }, dangerText: { color: '#C43E50', fontWeight: '700' }, disabled: { opacity: 0.5 },
});
