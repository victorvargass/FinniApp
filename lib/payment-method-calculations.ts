export function calculateAvailableBalance(
  reportedBalance: number,
  chargesAfterSnapshot: number,
  paymentsAfterSnapshot: number,
  installmentPurchasesAfterSnapshot = 0,
  incomesAfterSnapshot = 0,
  transfersInAfterSnapshot = 0,
  transfersOutAfterSnapshot = 0
) {
  return reportedBalance
    - chargesAfterSnapshot
    - installmentPurchasesAfterSnapshot
    + paymentsAfterSnapshot
    + incomesAfterSnapshot
    + transfersInAfterSnapshot
    - transfersOutAfterSnapshot;
}

export function getEstimatedPaymentDueDate(statementDate: string, dueDay: number) {
  const statement = new Date(`${statementDate}T12:00:00`);
  const year = statement.getFullYear();
  const statementMonth = statement.getMonth();
  const targetMonth = dueDay > statement.getDate() ? statementMonth : statementMonth + 1;
  const lastDay = new Date(year, targetMonth + 1, 0).getDate();
  return new Date(year, targetMonth, Math.min(dueDay, lastDay), 12);
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
