import React, { createContext, useContext, useRef } from 'react';

import { t } from '@/lib/i18n';
import type { DatabaseContextValue } from '@/contexts/DatabaseContext';

const PERIOD_KEYS = [
  'settings', 'periods', 'selectedPeriod', 'selectedPeriodId',
  'periodCategoryExpensesTotals', 'periodIncomesTotal', 'periodHistory',
  'periodExpensesTotal', 'isReady', 'isPeriodChanging', 'periodRefreshFailed',
  'refresh', 'selectPeriod', 'closeCurrentPeriod', 'setPeriodStartDate',
  'setPeriodEndDate', 'setPeriodDates',
] as const satisfies readonly (keyof DatabaseContextValue)[];

const MOVEMENT_KEYS = [
  'expenses', 'incomes', 'expenseNames', 'incomeNames',
  'addExpense', 'editExpense', 'removeExpense',
  'addIncome', 'editIncome', 'removeIncome',
] as const satisfies readonly (keyof DatabaseContextValue)[];

const PAYMENT_KEYS = [
  'paymentMethods', 'paymentMethodTotals', 'cardPaymentMovements', 'accountTransfers',
  'addPaymentMethod', 'editPaymentMethod', 'updatePaymentMethodBalance',
  'updatePaymentMethodBalances', 'setPaymentMethodActive', 'setDefaultPaymentMethod',
  'getPaymentMethodDeletionInfo', 'removePaymentMethod', 'getCreditCardAdjustment',
  'addCreditCardAdjustment', 'editCreditCardAdjustment', 'removeCreditCardAdjustment',
  'getAccountTransfer', 'addAccountTransfer', 'editAccountTransfer', 'removeAccountTransfer',
  'getCreditCardCycles', 'addCreditCardCycle', 'editCreditCardCycle',
  'reconcileCreditCardCycle', 'unreconcileCreditCardCycle',
] as const satisfies readonly (keyof DatabaseContextValue)[];

const SAVINGS_KEYS = [
  'savingsGroups', 'savingsGoals', 'periodSavingsGoalActivity',
  'periodSavingsFundingTotal', 'saveSavingsGroup', 'removeSavingsGroup',
  'addSavingsGoal', 'editSavingsGoal', 'addSavingsGoalBalanceAdjustment',
  'removeSavingsGoalBalanceAdjustment', 'setSavingsGoalStatus',
  'removeSavingsGoal', 'getSavingsGoalMovements',
] as const satisfies readonly (keyof DatabaseContextValue)[];

const DEBT_KEYS = [
  'unbilledCreditCardTotal', 'getDebtPlans', 'getDebtPlan', 'addInstallmentPurchase',
  'activateInstallmentPlan', 'settleInstallmentPlan', 'setDebtPlanShowOnHome',
  'restoreRemovedInstallment', 'removeInstallmentPlan', 'getDebts', 'getDebt',
  'addDebt', 'editDebt', 'addDebtPayment', 'addDebtPayments', 'editDebtPayment',
  'removeDebtPayment', 'addDebtBalanceAdjustment', 'removeDebtBalanceAdjustment',
  'setDebtArchived', 'removeDebt',
] as const satisfies readonly (keyof DatabaseContextValue)[];

const RECURRENCE_KEYS = [
  'recurringExpenses', 'recurringDecisions', 'recurringIncomes',
  'addRecurringExpense', 'editRecurringExpense', 'setRecurringExpenseActive',
  'removeRecurringExpense', 'editRecurringIncome', 'addRecurringIncome',
  'setRecurringIncomeActive', 'removeRecurringIncome', 'addRecurringIncomeFromSource',
  'approveRecurringOccurrence', 'skipRecurringOccurrence', 'dismissSkippedOccurrence',
  'markRecurringOccurrencePending', 'retryRecurringOccurrence',
] as const satisfies readonly (keyof DatabaseContextValue)[];

const ORGANIZER_KEYS = [
  'categories', 'contacts', 'relationshipTypes', 'incomeCategories',
  'addCategory', 'editCategory', 'getCategoryExpenseCount', 'removeCategory',
  'saveContact', 'removeContact', 'getContact', 'saveRelationshipType',
  'removeRelationshipType', 'saveIncomeCategory', 'removeIncomeCategory',
] as const satisfies readonly (keyof DatabaseContextValue)[];

const PREFERENCE_KEYS = [
  'settings', 'appNotifications', 'setAppNotificationRead',
  'markAppNotificationReadBySourceKey', 'deleteAppNotification', 'deleteAppNotifications',
  'setPushNotificationsEnabled', 'setMovementReminder', 'setHomePreferences',
  'runDatabaseMaintenance', 'resetLocalData',
] as const satisfies readonly (keyof DatabaseContextValue)[];

type KeysOf<T extends readonly (keyof DatabaseContextValue)[]> = T[number];
export type PeriodDatabaseValue = Pick<DatabaseContextValue, KeysOf<typeof PERIOD_KEYS>>;
export type MovementDatabaseValue = Pick<DatabaseContextValue, KeysOf<typeof MOVEMENT_KEYS>>;
export type PaymentDatabaseValue = Pick<DatabaseContextValue, KeysOf<typeof PAYMENT_KEYS>>;
export type SavingsDatabaseValue = Pick<DatabaseContextValue, KeysOf<typeof SAVINGS_KEYS>>;
export type DebtDatabaseValue = Pick<DatabaseContextValue, KeysOf<typeof DEBT_KEYS>>;
export type RecurrenceDatabaseValue = Pick<DatabaseContextValue, KeysOf<typeof RECURRENCE_KEYS>>;
export type OrganizerDatabaseValue = Pick<DatabaseContextValue, KeysOf<typeof ORGANIZER_KEYS>>;
export type PreferenceDatabaseValue = Pick<DatabaseContextValue, KeysOf<typeof PREFERENCE_KEYS>>;

const PeriodDatabaseContext = createContext<PeriodDatabaseValue | null>(null);
const MovementDatabaseContext = createContext<MovementDatabaseValue | null>(null);
const PaymentDatabaseContext = createContext<PaymentDatabaseValue | null>(null);
const SavingsDatabaseContext = createContext<SavingsDatabaseValue | null>(null);
const DebtDatabaseContext = createContext<DebtDatabaseValue | null>(null);
const RecurrenceDatabaseContext = createContext<RecurrenceDatabaseValue | null>(null);
const OrganizerDatabaseContext = createContext<OrganizerDatabaseValue | null>(null);
const PreferenceDatabaseContext = createContext<PreferenceDatabaseValue | null>(null);

function pick<T extends readonly (keyof DatabaseContextValue)[]>(
  source: DatabaseContextValue,
  keys: T
): Pick<DatabaseContextValue, T[number]> {
  const result = {} as Pick<DatabaseContextValue, T[number]>;
  for (const key of keys) Object.assign(result, { [key]: source[key] });
  return result;
}

function useShallowStablePick<T extends readonly (keyof DatabaseContextValue)[]>(
  source: DatabaseContextValue,
  keys: T
): Pick<DatabaseContextValue, T[number]> {
  const next = pick(source, keys);
  const stable = useRef(next);
  const previousRecord = stable.current as Record<keyof DatabaseContextValue, unknown>;
  const nextRecord = next as Record<keyof DatabaseContextValue, unknown>;
  if (keys.some((key) => previousRecord[key] !== nextRecord[key])) stable.current = next;
  return stable.current;
}

export function DatabaseDomainProviders({
  value,
  children,
}: {
  value: DatabaseContextValue;
  children: React.ReactNode;
}) {
  const periods = useShallowStablePick(value, PERIOD_KEYS);
  const movements = useShallowStablePick(value, MOVEMENT_KEYS);
  const payments = useShallowStablePick(value, PAYMENT_KEYS);
  const savings = useShallowStablePick(value, SAVINGS_KEYS);
  const debts = useShallowStablePick(value, DEBT_KEYS);
  const recurrences = useShallowStablePick(value, RECURRENCE_KEYS);
  const organizer = useShallowStablePick(value, ORGANIZER_KEYS);
  const preferences = useShallowStablePick(value, PREFERENCE_KEYS);

  return (
    <PeriodDatabaseContext.Provider value={periods}>
      <MovementDatabaseContext.Provider value={movements}>
        <PaymentDatabaseContext.Provider value={payments}>
          <SavingsDatabaseContext.Provider value={savings}>
            <DebtDatabaseContext.Provider value={debts}>
              <RecurrenceDatabaseContext.Provider value={recurrences}>
                <OrganizerDatabaseContext.Provider value={organizer}>
                  <PreferenceDatabaseContext.Provider value={preferences}>
                    {children}
                  </PreferenceDatabaseContext.Provider>
                </OrganizerDatabaseContext.Provider>
              </RecurrenceDatabaseContext.Provider>
            </DebtDatabaseContext.Provider>
          </SavingsDatabaseContext.Provider>
        </PaymentDatabaseContext.Provider>
      </MovementDatabaseContext.Provider>
    </PeriodDatabaseContext.Provider>
  );
}

function useRequiredContext<T>(context: React.Context<T | null>): T {
  const value = useContext(context);
  if (!value) throw new Error(t('errors.databaseProvider'));
  return value;
}

export const usePeriodDatabase = () => useRequiredContext(PeriodDatabaseContext);
export const useMovementDatabase = () => useRequiredContext(MovementDatabaseContext);
export const usePaymentDatabase = () => useRequiredContext(PaymentDatabaseContext);
export const useSavingsDatabase = () => useRequiredContext(SavingsDatabaseContext);
export const useDebtDatabase = () => useRequiredContext(DebtDatabaseContext);
export const useRecurrenceDatabase = () => useRequiredContext(RecurrenceDatabaseContext);
export const useOrganizerDatabase = () => useRequiredContext(OrganizerDatabaseContext);
export const usePreferenceDatabase = () => useRequiredContext(PreferenceDatabaseContext);
