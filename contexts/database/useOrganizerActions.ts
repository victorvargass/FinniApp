import { useCallback, useMemo } from 'react';

import * as db from '@/repositories';
import { t } from '@/lib/i18n';
import type {
  NewCategory,
  NewContact,
  NewIncomeCategory,
  NewRelationshipType,
  NewSavingsGroup,
} from '@/lib/types';

type Refresh = () => Promise<void>;

export function useOrganizerActions(refresh: Refresh) {
  const addCategory = useCallback(async (data: NewCategory) => {
    await db.createCategory(data);
    await refresh();
  }, [refresh]);

  const editCategory = useCallback(async (id: number, data: NewCategory) => {
    await db.updateCategory(id, data);
    await refresh();
  }, [refresh]);

  const removeCategory = useCallback(async (id: number, detachExpenses = false) => {
    const count = await db.getExpenseCountByCategory(id);
    if (count > 0 && !detachExpenses) {
      throw new Error(t('errors.categoryHasExpenses'));
    }
    await db.deleteCategory(id, detachExpenses);
    await refresh();
  }, [refresh]);

  const getCategoryExpenseCount = useCallback(
    (id: number) => db.getExpenseCountByCategory(id),
    []
  );

  const saveContact = useCallback(async (data: NewContact, id?: number) => {
    const savedId = await db.saveContact(data, id);
    await refresh();
    return savedId;
  }, [refresh]);

  const removeContact = useCallback(async (id: number) => {
    await db.deleteContact(id);
    await refresh();
  }, [refresh]);

  const getContact = useCallback((id: number) => db.getContact(id), []);

  const saveRelationshipType = useCallback(async (data: NewRelationshipType, id?: number) => {
    await db.saveRelationshipType(data, id);
    await refresh();
  }, [refresh]);

  const removeRelationshipType = useCallback(async (id: number) => {
    await db.deleteRelationshipType(id);
    await refresh();
  }, [refresh]);

  const saveIncomeCategory = useCallback(async (data: NewIncomeCategory, id?: number) => {
    await db.saveIncomeCategory(data, id);
    await refresh();
  }, [refresh]);

  const removeIncomeCategory = useCallback(async (id: number) => {
    await db.deleteIncomeCategory(id);
    await refresh();
  }, [refresh]);

  const saveSavingsGroup = useCallback(async (data: NewSavingsGroup, id?: number) => {
    await db.saveSavingsGroup(data, id);
    await refresh();
  }, [refresh]);

  const removeSavingsGroup = useCallback(async (id: number) => {
    await db.deleteSavingsGroup(id);
    await refresh();
  }, [refresh]);

  return useMemo(() => ({
    addCategory,
    editCategory,
    getCategoryExpenseCount,
    removeCategory,
    saveContact,
    removeContact,
    getContact,
    saveRelationshipType,
    removeRelationshipType,
    saveIncomeCategory,
    removeIncomeCategory,
    saveSavingsGroup,
    removeSavingsGroup,
  }), [
    addCategory,
    editCategory,
    getCategoryExpenseCount,
    getContact,
    removeCategory,
    removeContact,
    removeIncomeCategory,
    removeRelationshipType,
    removeSavingsGroup,
    saveContact,
    saveIncomeCategory,
    saveRelationshipType,
    saveSavingsGroup,
  ]);
}
