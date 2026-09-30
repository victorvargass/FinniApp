import { getDatabase, withExclusiveDatabaseTransaction } from '@/lib/database/connection';
import { t } from '@/lib/i18n';
import type {
  Contact,
  ContactBankAccount,
  NewContact,
  NewRelationshipType,
  RelationshipType,
} from '@/lib/types';

export async function getRelationshipTypes(): Promise<RelationshipType[]> {
  const database = await getDatabase();
  return database.getAllAsync<RelationshipType>(
    'SELECT id, name, color FROM contact_relationships ORDER BY name COLLATE NOCASE'
  );
}

export async function saveRelationshipType(data: NewRelationshipType, id?: number): Promise<void> {
  const name = data.name.trim();
  if (!name) throw new Error(t('database.relationshipNameRequired'));
  const database = await getDatabase();
  if (id == null) {
    await database.runAsync(
      'INSERT INTO contact_relationships (name, color) VALUES (?, ?)', name, data.color
    );
    return;
  }
  const result = await database.runAsync(
    'UPDATE contact_relationships SET name = ?, color = ? WHERE id = ?', name, data.color, id
  );
  if (result.changes === 0) throw new Error(t('database.relationshipMissing'));
}

export async function deleteRelationshipType(id: number): Promise<void> {
  const database = await getDatabase();
  await withExclusiveDatabaseTransaction(database, async (transaction) => {
    await transaction.runAsync(
      'UPDATE contacts SET relationship_type_id = NULL WHERE relationship_type_id = ?', id
    );
    const result = await transaction.runAsync('DELETE FROM contact_relationships WHERE id = ?', id);
    if (result.changes === 0) throw new Error(t('database.relationshipMissing'));
  });
}

function mapContactAccount(row: Record<string, unknown>): ContactBankAccount {
  return {
    id: Number(row.id),
    contactId: Number(row.contact_id),
    bankName: String(row.bank_name),
    holderName: row.holder_name == null ? null : String(row.holder_name),
    rut: row.rut == null ? null : String(row.rut),
    accountType: String(row.account_type),
    accountNumber: String(row.account_number),
    email: row.email == null ? null : String(row.email),
  };
}

export async function getContacts(): Promise<Contact[]> {
  const database = await getDatabase();
  const rows = await database.getAllAsync<Record<string, unknown>>(
    `SELECT contact.*, relationship.name AS relationship_name, relationship.color AS relationship_color
     FROM contacts contact
     LEFT JOIN contact_relationships relationship ON relationship.id = contact.relationship_type_id
     ORDER BY contact.name COLLATE NOCASE, contact.nickname COLLATE NOCASE`
  );
  const accounts = await database.getAllAsync<Record<string, unknown>>(
    'SELECT * FROM contact_bank_accounts ORDER BY contact_id, id'
  );
  return rows.map((row) => ({
    id: Number(row.id),
    name: String(row.name),
    nickname: row.nickname == null ? null : String(row.nickname),
    relationshipTypeId: row.relationship_type_id == null ? null : Number(row.relationship_type_id),
    relationshipTypeName: row.relationship_name == null ? null : String(row.relationship_name),
    relationshipTypeColor: row.relationship_color == null ? null : String(row.relationship_color),
    email: row.email == null ? null : String(row.email),
    phone: row.phone == null ? null : String(row.phone),
    notes: row.notes == null ? null : String(row.notes),
    bankAccounts: accounts
      .filter((account) => Number(account.contact_id) === Number(row.id))
      .map(mapContactAccount),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  }));
}

export async function getContact(id: number): Promise<Contact | null> {
  return (await getContacts()).find((contact) => contact.id === id) ?? null;
}

function validateContact(data: NewContact): void {
  if (!data.name.trim()) throw new Error(t('database.contactNameRequired'));
  for (const account of data.bankAccounts) {
    if (!account.bankName.trim() || !account.accountType.trim() || !account.accountNumber.trim()) {
      throw new Error(t('database.contactAccountRequired'));
    }
  }
}

export async function saveContact(data: NewContact, id?: number): Promise<number> {
  validateContact(data);
  const database = await getDatabase();
  let savedContactId = id ?? 0;
  await withExclusiveDatabaseTransaction(database, async (transaction) => {
    let contactId = id;
    if (contactId == null) {
      const result = await transaction.runAsync(
        `INSERT INTO contacts (name, nickname, relationship_type_id, email, phone, notes)
         VALUES (?, ?, ?, ?, ?, ?)`,
        data.name.trim(), data.nickname?.trim() || null, data.relationshipTypeId,
        data.email?.trim() || null, data.phone?.trim() || null, data.notes?.trim() || null
      );
      contactId = result.lastInsertRowId;
      savedContactId = contactId;
    } else {
      const result = await transaction.runAsync(
        `UPDATE contacts SET name = ?, nickname = ?, relationship_type_id = ?, email = ?, phone = ?,
          notes = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        data.name.trim(), data.nickname?.trim() || null, data.relationshipTypeId,
        data.email?.trim() || null, data.phone?.trim() || null, data.notes?.trim() || null, contactId
      );
      if (result.changes === 0) throw new Error(t('database.contactMissing'));
      await transaction.runAsync('DELETE FROM contact_bank_accounts WHERE contact_id = ?', contactId);
    }
    for (const account of data.bankAccounts) {
      await transaction.runAsync(
        `INSERT INTO contact_bank_accounts
          (contact_id, bank_name, holder_name, rut, account_type, account_number, email)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        contactId, account.bankName.trim(), account.holderName?.trim() || null,
        account.rut?.trim() || null, account.accountType.trim(), account.accountNumber.trim(),
        account.email?.trim() || null
      );
    }
  });
  return savedContactId;
}

export async function deleteContact(id: number): Promise<void> {
  const database = await getDatabase();
  const linked = await database.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) AS count FROM manual_debts WHERE contact_id = ?', id
  );
  if (Number(linked?.count ?? 0) > 0) throw new Error(t('database.contactHasDebts'));
  const result = await database.runAsync('DELETE FROM contacts WHERE id = ?', id);
  if (result.changes === 0) throw new Error(t('database.contactMissing'));
}
