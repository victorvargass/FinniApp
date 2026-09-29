import type { Debt, DebtPlan, PaymentMethod, SavingsGoal, SavingsGoalPeriodActivity } from './types';

export function visibleHomePaymentMethods(methods: PaymentMethod[]): PaymentMethod[] {
  return methods.filter((method) => method.showOnHome !== false);
}

export function visibleHomeSavingsActivity(
  items: SavingsGoalPeriodActivity[],
  goals: SavingsGoal[]
): SavingsGoalPeriodActivity[] {
  const visibleGoalIds = new Set(
    goals.filter((goal) => goal.showOnHome !== false).map((goal) => goal.id)
  );
  return items.filter((item) => visibleGoalIds.has(item.goalId));
}

export function visibleHomeDebts(debts: Debt[]): Debt[] {
  return debts.filter((debt) => debt.showOnHome !== false);
}

export function visibleHomeDebtPlans(plans: DebtPlan[], methods: PaymentMethod[]): DebtPlan[] {
  const visibleMethodIds = new Set(visibleHomePaymentMethods(methods).map((method) => method.id));
  return plans.filter((plan) => plan.showOnHome !== false && visibleMethodIds.has(plan.paymentMethodId));
}
