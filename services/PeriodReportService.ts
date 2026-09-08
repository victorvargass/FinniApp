import { Asset } from 'expo-asset';
import { File, Paths } from 'expo-file-system';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';

import { getPeriodSavingsGoalActivity, getPeriodStatement } from '@/lib/db';
import { formatCLP } from '@/lib/format';
import { APP_LOCALE, t } from '@/lib/i18n';
import type {
  ExpenseWithCategory,
  Income,
  PaymentMethodType,
  PeriodHistory,
  PeriodHistoryCategory,
  PeriodHistoryPaymentMethod,
  SavingsGoalPeriodActivity,
} from '@/lib/types';

const REPORT_LOGO = require('@/assets/images/splash-icon.png');

const COLORS = {
  ink: '#15313b',
  muted: '#64777e',
  brand: '#087f8c',
  brandDark: '#075a64',
  brandSoft: '#e7f5f5',
  income: '#14845f',
  expense: '#d14d41',
  border: '#dce7e9',
  surface: '#f6f9f9',
};

function escapeHtml(value: string): string {
  return value.replace(/[&<>'"]/g, (character) => {
    const entities: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      "'": '&#39;',
      '"': '&quot;',
    };
    return entities[character];
  });
}

function parseLocalDate(value: string): Date {
  return new Date(`${value}T12:00:00`);
}

function formatReportDate(value: string): string {
  return new Intl.DateTimeFormat(APP_LOCALE, { day: '2-digit', month: 'long', year: 'numeric' }).format(parseLocalDate(value));
}

function formatShortDate(value: string): string {
  const parts = new Intl.DateTimeFormat(APP_LOCALE, { day: '2-digit', month: 'short' }).formatToParts(parseLocalDate(value));
  return `${parts.find((part) => part.type === 'day')?.value ?? ''} - ${(parts.find((part) => part.type === 'month')?.value ?? '').replace('.', '')}`;
}

function formatFileDate(value: string): string {
  const date = parseLocalDate(value);
  const day = String(date.getDate()).padStart(2, '0');
  const month = new Intl.DateTimeFormat(APP_LOCALE, { month: 'short' }).format(date).replace('.', '');
  const year = String(date.getFullYear()).slice(-2);
  return `${day}-${month}-${year}`;
}

export function getPeriodReportFileName(
  period: Pick<PeriodHistory, 'startDate' | 'endDate'>
): string {
  return t('report.fileName', { start: formatFileDate(period.startDate), end: formatFileDate(period.endDate) });
}

function total(items: { amount: number }[]): number {
  return items.reduce((sum, item) => sum + item.amount, 0);
}

async function loadReportLogoDataUri(): Promise<string | null> {
  try {
    const [asset] = await Asset.loadAsync(REPORT_LOGO);
    if (asset.localUri) {
      const base64 = await new File(asset.localUri).base64();
      return `data:image/png;base64,${base64}`;
    }
    return asset.uri || null;
  } catch {
    return null;
  }
}

const PAYMENT_METHOD_TYPE_LABELS: Record<PaymentMethodType, string> = {
  cash: t('paymentMethods.cash'), debit: t('paymentMethods.debit'),
  prepaid: t('paymentMethods.prepaid'), credit: t('paymentMethods.credit'),
};

function paymentMethodTypeLabel(type: PaymentMethodType | null): string {
  return type ? PAYMENT_METHOD_TYPE_LABELS[type] : t('report.noType');
}

function categoryRows(
  categories: PeriodHistoryCategory[],
  expensesTotal: number
): string {
  if (categories.length === 0) {
    return `<div class="empty">${t('report.noExpenses')}</div>`;
  }

  return categories
    .map((category) => {
      const percentage = expensesTotal > 0
        ? ((category.total / expensesTotal) * 100).toFixed(1)
        : '0.0';
      const safeColor = /^#[0-9a-f]{3,8}$/i.test(category.categoryColor)
        ? category.categoryColor
        : '#95a5a6';

      return `
        <div class="category-row">
          <div class="category-name">
            <span class="dot" style="background:${safeColor}"></span>
            ${escapeHtml(category.categoryName)}
          </div>
          <div class="category-value">${formatCLP(category.total)} - ${percentage}%</div>
        </div>`;
    })
    .join('');
}

function donutChart(
  categories: PeriodHistoryCategory[],
  expensesTotal: number
): string {
  const radius = 43;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  const segments = categories
    .filter((category) => category.total > 0)
    .map((category) => {
      const safeColor = /^#[0-9a-f]{3,8}$/i.test(category.categoryColor)
        ? category.categoryColor
        : '#95a5a6';
      const length = expensesTotal > 0
        ? (category.total / expensesTotal) * circumference
        : 0;
      const segment = `
        <circle
          cx="60"
          cy="60"
          r="${radius}"
          fill="none"
          stroke="${safeColor}"
          stroke-width="18"
          stroke-dasharray="${length.toFixed(3)} ${(circumference - length).toFixed(3)}"
          stroke-dashoffset="${(-offset).toFixed(3)}"
          transform="rotate(-90 60 60)"
        />`;
      offset += length;
      return segment;
    })
    .join('');

  return `
    <div class="donut-column">
      <div class="donut-wrap">
        <svg class="donut" viewBox="0 0 120 120" role="img" aria-label="${t('report.categoryDistribution')}">
          <circle cx="60" cy="60" r="${radius}" fill="none" stroke="#e8eeee" stroke-width="18" />
          ${segments}
          <circle cx="60" cy="60" r="31" fill="white" />
        </svg>
        <div class="donut-center">
          <strong>${formatCLP(expensesTotal)}</strong>
          <span>${t('report.totalExpenses')}</span>
        </div>
      </div>
    </div>`;
}

function paymentMethodRows(
  methods: PeriodHistoryPaymentMethod[],
  expenses: ExpenseWithCategory[],
  expensesTotal: number
): string {
  if (methods.length === 0) {
    return `<div class="empty">${t('report.noPaymentMethods')}</div>`;
  }

  const movementCounts = expenses.reduce((counts, expense) => {
    const key = expense.paymentMethodId == null ? 'unspecified' : String(expense.paymentMethodId);
    counts.set(key, (counts.get(key) ?? 0) + 1);
    return counts;
  }, new Map<string, number>());

  return methods
    .map((method) => {
      const key = method.paymentMethodId == null ? 'unspecified' : String(method.paymentMethodId);
      const count = movementCounts.get(key) ?? 0;
      const percentage = expensesTotal > 0
        ? ((method.total / expensesTotal) * 100).toFixed(1)
        : '0.0';
      const safeColor = /^#[0-9a-f]{3,8}$/i.test(method.paymentMethodColor)
        ? method.paymentMethodColor
        : '#95a5a6';
      const details = method.paymentMethodId == null
        ? t('report.noInformation')
        : [
            paymentMethodTypeLabel(method.paymentMethodType),
            method.paymentMethodType === 'credit' && method.billingDay
              ? t('report.approximateBillingDay', { day: method.billingDay })
              : null,
            method.active === false ? t('report.disabled') : t('common.active'),
          ].filter(Boolean).join(' - ');

      return `
        <tr>
          <td>
            <div class="method-name"><span class="dot" style="background:${safeColor}"></span><strong>${escapeHtml(method.paymentMethodName)}</strong></div>
            <div class="row-note">${escapeHtml(details)}</div>
          </td>
          <td class="movement-count">${count} ${count === 1 ? t('report.movementOne') : t('report.movementOther')}</td>
          <td class="percentage">${percentage}%</td>
          <td class="amount">${formatCLP(method.total)}</td>
        </tr>`;
    })
    .join('');
}

function expenseRows(expenses: ExpenseWithCategory[]): string {
  if (expenses.length === 0) {
    return `<tr><td colspan="5" class="empty-cell">${t('report.noExpenses')}</td></tr>`;
  }

  return expenses
    .map((expense) => {
      const categoryColor = expense.categoryColor && /^#[0-9a-f]{3,8}$/i.test(expense.categoryColor)
        ? expense.categoryColor
        : '#95a5a6';
      const paymentMethodColor = expense.paymentMethodColor && /^#[0-9a-f]{3,8}$/i.test(expense.paymentMethodColor)
        ? expense.paymentMethodColor
        : '#95a5a6';
      const notes = [
        expense.originalAmount && expense.originalAmount !== expense.amount
          ? t('report.splitShare', { share: formatCLP(expense.amount), total: formatCLP(expense.originalAmount) })
          : null,
        expense.savingsGoalId != null && expense.savingsKind === 'contribution'
          ? t('report.savingsContribution', { goal: expense.savingsGoalName ?? t('savings.goal') })
          : null,
        expense.savingsGoalId != null && expense.savingsKind === 'funded_expense'
          ? t('report.fundedFromSavings', { goal: expense.savingsGoalName ?? t('savings.goal') })
          : null,
        expense.debtPlanId != null && expense.installmentNumber != null
          ? t('report.installmentDetail', {
              number: expense.installmentNumber,
              total: expense.totalInstallments ?? '?',
            })
          : expense.debtPlanId != null
            ? t('report.installmentSettlement')
            : null,
        expense.debtId != null ? t('report.debtPayment') : null,
        expense.recurringExpenseId != null ? t('report.recurringMovement') : null,
      ].filter((note): note is string => Boolean(note));
      const detailNotes = notes.map((note) => `<div class="row-note">${escapeHtml(note)}</div>`).join('');
      const paymentMethodNote = expense.paymentMethodType
        ? `<div class="row-note">${paymentMethodTypeLabel(expense.paymentMethodType)}</div>`
        : '';
      return `
        <tr>
          <td class="date">${formatShortDate(expense.date)}</td>
          <td><strong>${escapeHtml(expense.name)}</strong>${detailNotes}</td>
          <td class="category-cell"><span class="tag" style="border-color:${categoryColor}">${escapeHtml(expense.categoryName ?? t('expenses.noCategory'))}</span></td>
          <td class="payment-method-cell"><span class="tag" style="border-color:${paymentMethodColor}">${escapeHtml(expense.paymentMethodName ?? t('common.notSpecified'))}</span>${paymentMethodNote}</td>
          <td class="amount expense">-${formatCLP(expense.amount)}</td>
        </tr>`;
    })
    .join('');
}

function incomeRows(incomes: Income[]): string {
  if (incomes.length === 0) {
    return `<tr><td colspan="3" class="empty-cell">${t('report.noIncomes')}</td></tr>`;
  }

  return incomes
    .map((income) => `
      <tr>
        <td class="date">${formatShortDate(income.date)}</td>
        <td><strong>${escapeHtml(income.name)}</strong>${income.savingsGoalId != null ? `<div class="row-note">${escapeHtml(t('report.savingsTransferFrom', { goal: income.savingsGoalName ?? t('savings.goal') }))}</div>` : ''}${income.recurringIncomeId != null ? `<div class="row-note">${t('report.recurringMovement')}</div>` : ''}</td>
        <td class="amount income">+${formatCLP(income.amount)}</td>
      </tr>`)
    .join('');
}

function savingsGoalRows(items: SavingsGoalPeriodActivity[]): string {
  return items
    .filter((item) => item.openingAmount !== 0 || item.netActivity !== 0 || item.closingAmount !== 0)
    .map((item) => {
      const progress = item.targetAmount > 0
        ? Math.min(100, Math.max(0, (item.closingAmount / item.targetAmount) * 100))
        : 0;
      const activity = [
        item.contributions > 0 ? t('report.savingsAdded', { amount: formatCLP(item.contributions) }) : null,
        item.withdrawals + item.fundedExpenses > 0
          ? t('report.savingsUsed', { amount: formatCLP(item.withdrawals + item.fundedExpenses) })
          : null,
        item.adjustments !== 0
          ? t('report.savingsAdjusted', { amount: formatCLP(item.adjustments) })
          : null,
      ].filter(Boolean).join(' · ') || t('report.noSavingsActivity');
      const safeColor = /^#[0-9a-f]{3,8}$/i.test(item.goalColor) ? item.goalColor : COLORS.brand;

      return `<div class="goal-row">
        <div class="goal-heading"><strong>${escapeHtml(item.goalName)}</strong><span>${formatCLP(item.closingAmount)} / ${formatCLP(item.targetAmount)}</span></div>
        <div class="goal-track"><div class="goal-progress" style="width:${progress.toFixed(1)}%;background:${safeColor}"></div></div>
        <div class="row-note">${escapeHtml(activity)}</div>
      </div>`;
    })
    .join('');
}

export function buildPeriodReportHtml(
  period: PeriodHistory,
  expenses: ExpenseWithCategory[],
  incomes: Income[],
  savingsGoals: SavingsGoalPeriodActivity[] = [],
  logoDataUri: string | null = null
): string {
  const expensesTotal = total(expenses);
  const savingsWithdrawals = total(incomes.filter((income) => income.savingsGoalId != null));
  const incomesTotal = total(incomes.filter((income) => income.savingsGoalId == null));
  const savingsFunding = period.savingsFundingTotal ?? 0;
  const savingsAvailable = savingsWithdrawals + savingsFunding;
  const balance = incomesTotal + savingsAvailable - expensesTotal;
  const savingsRows = savingsGoalRows(savingsGoals);
  const generatedAt = new Intl.DateTimeFormat(APP_LOCALE, {
    dateStyle: 'long',
    timeStyle: 'short',
  }).format(new Date());

  return `<!doctype html>
  <html lang="es">
    <head>
      <meta charset="utf-8" />
      <style>
        @page { size: A4 portrait; margin: 30px 32px 38px; }
        * { box-sizing: border-box; }
        body { margin: 0; color: ${COLORS.ink}; background: #fff; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif; font-size: 11px; line-height: 1.45; }
        .header { display: flex; justify-content: space-between; align-items: flex-start; padding: 2px 2px 12px; }
        .brand-logo { display: block; width: 150px; height: auto; }
        .brand { color: ${COLORS.ink}; font-size: 27px; font-weight: 800; letter-spacing: -.8px; }
        .brand span { color: ${COLORS.brand}; }
        .eyebrow { margin-bottom: 5px; color: ${COLORS.brand}; font-size: 8px; font-weight: 800; letter-spacing: 1.5px; text-transform: uppercase; }
        .period { color: ${COLORS.brandDark}; font-size: 13px; font-weight: 750; text-align: right; }
        .generated { margin-top: 5px; color: ${COLORS.muted}; font-size: 8px; text-align: right; }
        .summary { display: flex; gap: 12px; margin: 10px 0 20px; }
        .summary-card { display: flex; align-items: center; gap: 11px; flex: 1 1 0; min-width: 0; padding: 15px; border: 1px solid #e5ecee; border-radius: 14px; background: white; box-shadow: 0 4px 14px rgba(21,49,59,.08); }
        .summary-card.balance { color: white; background: linear-gradient(135deg, ${COLORS.brand} 0%, ${COLORS.brandDark} 100%); border-color: transparent; }
        .summary-icon { display: flex; align-items: center; justify-content: center; width: 36px; height: 36px; flex: 0 0 36px; border-radius: 50%; }
        .summary-icon svg { width: 20px; height: 20px; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
        .summary-icon.income-icon { color: ${COLORS.income}; background: #e9f6f0; }
        .summary-icon.expense-icon { color: ${COLORS.expense}; background: #fdeeed; }
        .balance .summary-icon { width: 44px; height: 44px; flex-basis: 44px; color: white; background: rgba(255,255,255,.14); }
        .balance .summary-icon svg { width: 24px; height: 24px; }
        .summary-copy { min-width: 0; }
        .label { color: ${COLORS.ink}; font-size: 9px; font-weight: 700; letter-spacing: .2px; }
        .balance .label { color: rgba(255,255,255,.88); }
        .value { margin-top: 5px; font-size: 17px; font-weight: 800; letter-spacing: -.2px; }
        .balance .value { color: white; font-size: 23px; }
        .balance-note { margin-top: 3px; color: rgba(255,255,255,.78); font-size: 7px; }
        .income { color: ${COLORS.income}; }
        .expense { color: ${COLORS.expense}; }
        .section { margin-top: 20px; break-inside: avoid; }
        .section.transactions { padding: 15px 16px 12px; break-inside: auto; border: 1px solid #e5ecee; border-radius: 14px; box-shadow: 0 3px 12px rgba(21,49,59,.055); }
        .section.keep-together { break-inside: avoid; }
        .section-title { margin: 0 0 11px; font-size: 15px; font-weight: 800; letter-spacing: -.15px; }
        .section-subtitle { margin-top: -8px; margin-bottom: 11px; color: ${COLORS.muted}; font-size: 8px; }
        .category-section { padding: 16px 18px 17px; border: 1px solid #e5ecee; border-radius: 14px; box-shadow: 0 3px 12px rgba(21,49,59,.055); }
        .category-overview { display: flex; align-items: center; gap: 28px; }
        .donut-column { display: flex; align-items: center; justify-content: center; flex: 1 1 0; min-width: 0; }
        .donut-wrap { position: relative; width: 190px; height: 190px; flex: 0 0 190px; }
        .donut { display: block; width: 190px; height: 190px; }
        .donut-center { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; }
        .donut-center strong { font-size: 15px; letter-spacing: -.3px; }
        .donut-center span { margin-top: 2px; color: ${COLORS.muted}; font-size: 8px; }
        .category-grid { display: grid; grid-template-columns: 1fr; flex: 1 1 0; min-width: 0; }
        .category-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; min-height: 28px; padding: 5px 0; border-bottom: 1px solid #edf2f3; break-inside: avoid; }
        .category-row:last-child { border-bottom: 0; }
        .category-name { display: flex; align-items: center; min-width: 0; font-weight: 650; }
        .category-value { color: ${COLORS.muted}; white-space: nowrap; font-size: 9px; }
        .payment-method-section { padding: 15px 16px 12px; border: 1px solid #e5ecee; border-radius: 14px; box-shadow: 0 3px 12px rgba(21,49,59,.055); }
        .method-name { display: flex; align-items: center; min-width: 0; }
        .dot { width: 8px; height: 8px; margin-right: 6px; border-radius: 50%; flex: none; }
        table { width: 100%; border-collapse: separate; border-spacing: 0; overflow: hidden; }
        thead { display: table-header-group; }
        tr { break-inside: avoid; }
        th { padding: 8px 10px; color: ${COLORS.muted}; background: #f3f7f8; border: 0; font-size: 8px; font-weight: 700; letter-spacing: .35px; text-align: left; }
        th:first-child { border-radius: 8px 0 0 8px; }
        th:last-child { border-radius: 0 8px 8px 0; }
        td { padding: 10px; border-bottom: 1px solid #edf2f3; vertical-align: top; }
        td.date, td.category-cell, td.payment-method-cell, td.movement-count, td.percentage, td.amount { vertical-align: middle; }
        tbody tr:nth-child(even) td { background: #fbfcfc; }
        tbody tr:last-child td { border-bottom: 0; }
        .date { width: 66px; color: ${COLORS.muted}; white-space: nowrap; }
        .category-cell { width: 112px; }
        .payment-method-cell { width: 124px; }
        .movement-count { width: 100px; color: ${COLORS.muted}; white-space: nowrap; }
        .percentage { width: 52px; color: ${COLORS.muted}; text-align: right; white-space: nowrap; }
        .amount { width: 115px; font-weight: 800; text-align: right; white-space: nowrap; }
        .tag { display: inline-block; padding: 2px 7px; color: ${COLORS.muted}; background: #edf3f4; border: 1px solid; border-radius: 99px; font-size: 8px; white-space: nowrap; }
        .row-note { margin-top: 2px; color: ${COLORS.muted}; font-size: 8px; }
        .goals-section { padding: 15px 16px 12px; border: 1px solid #e5ecee; border-radius: 14px; box-shadow: 0 3px 12px rgba(21,49,59,.055); }
        .goal-row { padding: 8px 0; border-bottom: 1px solid #edf2f3; break-inside: avoid; }
        .goal-row:last-child { border-bottom: 0; }
        .goal-heading { display: flex; justify-content: space-between; gap: 12px; }
        .goal-heading span { color: ${COLORS.muted}; font-size: 9px; white-space: nowrap; }
        .goal-track { height: 5px; margin-top: 6px; overflow: hidden; border-radius: 99px; background: #e7eeee; }
        .goal-progress { height: 100%; border-radius: 99px; }
        .table-total { display: flex; justify-content: flex-end; gap: 15px; padding: 10px 10px 0; font-weight: 750; }
        .empty, .empty-cell { padding: 14px; color: ${COLORS.muted}; text-align: center; }
        .footer { margin-top: 15px; padding-top: 5px; color: #91a0a5; font-size: 7px; text-align: center; }
      </style>
    </head>
    <body>
      <header class="header">
        <div>
          <div class="eyebrow">${t('report.financialReport')}</div>
          ${logoDataUri
            ? `<img class="brand-logo" src="${escapeHtml(logoDataUri)}" alt="FinniApp" />`
            : '<div class="brand">Finni<span>App</span></div>'}
        </div>
        <div>
          <div class="period">${formatReportDate(period.startDate)} - ${formatReportDate(period.endDate)}</div>
          <div class="generated">${t('report.generatedOn', { date: escapeHtml(generatedAt) })}</div>
        </div>
      </header>

      <section class="summary">
        <div class="summary-card">
          <div class="summary-icon income-icon"><svg viewBox="0 0 24 24"><path d="M4 17l6-6 4 4 6-8"/><path d="M15 7h5v5"/></svg></div>
          <div class="summary-copy"><div class="label">${t('navigation.incomes')}</div><div class="value income">${formatCLP(incomesTotal)}</div></div>
        </div>
        <div class="summary-card">
          <div class="summary-icon expense-icon"><svg viewBox="0 0 24 24"><path d="M4 7l6 6 4-4 6 8"/><path d="M15 17h5v-5"/></svg></div>
          <div class="summary-copy"><div class="label">${t('navigation.expenses')}</div><div class="value expense">${formatCLP(expensesTotal)}</div></div>
        </div>
        <div class="summary-card balance">
          <div class="summary-icon"><svg viewBox="0 0 24 24"><path d="M4 7h14a2 2 0 0 1 2 2v9H6a2 2 0 0 1-2-2V7z"/><path d="M4 7l2-3h10l2 3"/><path d="M15 12h5v4h-5a2 2 0 1 1 0-4z"/></svg></div>
          <div class="summary-copy"><div class="label">${t('report.periodBalance')}</div><div class="value">${formatCLP(balance)}</div>${savingsAvailable > 0 ? `<div class="balance-note">${t('report.includesReleasedSavings', { amount: formatCLP(savingsAvailable) })}</div>` : ''}</div>
        </div>
      </section>

      ${savingsRows ? `<section class="section goals-section">
        <h2 class="section-title">${t('report.savingsGoals')}</h2>
        <div class="section-subtitle">${t('report.savingsGoalsSubtitle')}</div>
        ${savingsRows}
      </section>` : ''}

      <section class="section category-section">
        <h2 class="section-title">${t('report.expenseSummary')}</h2>
        <div class="category-overview">
          ${donutChart(period.categories, expensesTotal)}
          <div class="category-grid">${categoryRows(period.categories, expensesTotal)}</div>
        </div>
      </section>

      <section class="section payment-method-section">
        <h2 class="section-title">${t('report.expensesByPayment')}</h2>
        <div class="section-subtitle">${t('report.paymentSubtitle')}</div>
        <table>
          <thead><tr><th>${t('navigation.paymentMethod')}</th><th>${t('report.usage')}</th><th style="text-align:right">${t('report.percentage')}</th><th style="text-align:right">${t('filters.amount')}</th></tr></thead>
          <tbody>${paymentMethodRows(period.paymentMethods ?? [], expenses, expensesTotal)}</tbody>
        </table>
      </section>

      <section class="section transactions${expenses.length <= 8 ? ' keep-together' : ''}">
        <h2 class="section-title">${t('report.detailExpenses')}</h2>
        <div class="section-subtitle">${expenses.length} ${expenses.length === 1 ? 'movimiento' : 'movimientos'}</div>
        <table>
          <thead><tr><th>${t('forms.date')}</th><th>${t('report.description')}</th><th>${t('navigation.category')}</th><th>${t('navigation.paymentMethod')}</th><th style="text-align:right">${t('report.amount')}</th></tr></thead>
          <tbody>${expenseRows(expenses)}</tbody>
        </table>
        <div class="table-total"><span>${t('expenses.total')}</span><span class="expense">${formatCLP(expensesTotal)}</span></div>
      </section>

      <section class="section transactions${incomes.length <= 8 ? ' keep-together' : ''}">
        <h2 class="section-title">${t('report.detailIncomes')}</h2>
        <div class="section-subtitle">${incomes.length} ${incomes.length === 1 ? 'movimiento' : 'movimientos'}</div>
        <table>
          <thead><tr><th>${t('forms.date')}</th><th>${t('report.description')}</th><th style="text-align:right">${t('report.amount')}</th></tr></thead>
          <tbody>${incomeRows(incomes)}</tbody>
        </table>
        <div class="table-total"><span>${t('report.totalEntries')}</span><span class="income">${formatCLP(incomesTotal + savingsWithdrawals)}</span></div>
      </section>

      <footer class="footer">${t('report.generatedFrom')}</footer>
    </body>
  </html>`;
}

export async function exportPeriodReport(period: PeriodHistory): Promise<void> {
  const [{ expenses, incomes }, savingsGoals, logoDataUri] = await Promise.all([
    getPeriodStatement(period.periodId),
    getPeriodSavingsGoalActivity(period.periodId),
    loadReportLogoDataUri(),
  ]);
  const html = buildPeriodReportHtml(period, expenses, incomes, savingsGoals, logoDataUri);

  if (Platform.OS === 'web') {
    await Print.printAsync({ html });
    return;
  }

  const { uri } = await Print.printToFileAsync({ html });
  const temporaryFile = new File(uri);
  const namedFile = new File(Paths.cache, getPeriodReportFileName(period));

  if (namedFile.exists) {
    namedFile.delete();
  }
  temporaryFile.move(namedFile);

  const canShare = await Sharing.isAvailableAsync();

  if (!canShare) {
    await Print.printAsync({ uri: namedFile.uri });
    return;
  }

  await Sharing.shareAsync(namedFile.uri, {
    dialogTitle: t('report.shareTitle'),
    mimeType: 'application/pdf',
    UTI: 'com.adobe.pdf',
  });
}
