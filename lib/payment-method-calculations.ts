export function calculateAvailableBalance(
  reportedBalance: number,
  chargesAfterSnapshot: number,
  paymentsAfterSnapshot: number,
  installmentPurchasesAfterSnapshot = 0,
  incomesAfterSnapshot = 0,
  transfersInAfterSnapshot = 0,
  transfersOutAfterSnapshot = 0,
  adjustmentsAfterSnapshot = 0
) {
  return reportedBalance
    - chargesAfterSnapshot
    - installmentPurchasesAfterSnapshot
    + paymentsAfterSnapshot
    + incomesAfterSnapshot
    + transfersInAfterSnapshot
    - transfersOutAfterSnapshot
    + adjustmentsAfterSnapshot;
}

export function getEstimatedPaymentDueDate(statementDate: string, dueDay: number) {
  const statement = new Date(`${statementDate}T12:00:00`);
  const year = statement.getFullYear();
  const statementMonth = statement.getMonth();
  const targetMonth = dueDay > statement.getDate() ? statementMonth : statementMonth + 1;
  const lastDay = new Date(year, targetMonth + 1, 0).getDate();
  return new Date(year, targetMonth, Math.min(dueDay, lastDay), 12);
}

function getNextBillingDate(billingDay: number, referenceDate: Date) {
  const year = referenceDate.getFullYear();
  const month = referenceDate.getMonth();
  const lastDay = new Date(year, month + 1, 0).getDate();
  const candidate = new Date(year, month, Math.min(billingDay, lastDay), 12);
  const referenceDay = new Date(year, month, referenceDate.getDate(), 12);
  if (candidate >= referenceDay) return candidate;

  const nextMonth = month + 1;
  const nextMonthLastDay = new Date(year, nextMonth + 1, 0).getDate();
  return new Date(year, nextMonth, Math.min(billingDay, nextMonthLastDay), 12);
}

function toLocalDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getCardDueDate(
  method: Pick<PaymentMethod, 'billingDay' | 'billedAmount' | 'paymentDueDay' | 'statementDate'>,
  referenceDate = new Date()
): { date: Date; estimated: boolean } | null {
  if (method.paymentDueDay == null) return null;

  if (method.billedAmount > 0 && method.statementDate) {
    return {
      date: getEstimatedPaymentDueDate(method.statementDate, method.paymentDueDay),
      estimated: false,
    };
  }

  if (method.billingDay == null) return null;
  const nextBillingDate = getNextBillingDate(method.billingDay, referenceDate);
  return {
    date: getEstimatedPaymentDueDate(toLocalDateKey(nextBillingDate), method.paymentDueDay),
    estimated: true,
  };
}

export function findUrgentCardPayment(
  methods: PaymentMethod[],
  referenceDate = new Date(),
  horizonDays = 7
): { method: PaymentMethod; dueDate: Date; daysUntil: number } | null {
  const referenceKey = Date.UTC(
    referenceDate.getFullYear(),
    referenceDate.getMonth(),
    referenceDate.getDate()
  );

  return methods
    .filter((method) => method.active
      && method.type === 'credit'
      && method.billedAmount > 0
      && method.statementDate != null
      && method.paymentDueDay != null)
    .map((method) => {
      const dueDate = getEstimatedPaymentDueDate(method.statementDate!, method.paymentDueDay!);
      const dueKey = Date.UTC(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate());
      return { method, dueDate, daysUntil: Math.round((dueKey - referenceKey) / DAY_MS) };
    })
    .filter((item) => item.daysUntil <= horizonDays)
    .sort((first, second) => first.daysUntil - second.daysUntil)[0] ?? null;
}
import type { PaymentMethod } from './types';

const DAY_MS = 24 * 60 * 60 * 1000;
