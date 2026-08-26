import { File, Paths } from 'expo-file-system';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';

import { getPeriodStatement } from '@/lib/db';
import { formatCLP } from '@/lib/format';
import type {
  ExpenseWithCategory,
  Income,
  PeriodHistory,
  PeriodHistoryCategory,
} from '@/lib/types';

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
  const date = parseLocalDate(value);
  const months = [
    'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
    'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
  ];
  return `${String(date.getDate()).padStart(2, '0')} ${months[date.getMonth()]} ${date.getFullYear()}`;
}

function formatShortDate(value: string): string {
  const date = parseLocalDate(value);
  const months = [
    'ene', 'feb', 'mar', 'abr', 'may', 'jun',
    'jul', 'ago', 'sep', 'oct', 'nov', 'dic',
  ];
  return `${String(date.getDate()).padStart(2, '0')} - ${months[date.getMonth()]}`;
}

function formatFileDate(value: string): string {
  const date = parseLocalDate(value);
  const day = String(date.getDate()).padStart(2, '0');
  const months = [
    'ene', 'feb', 'mar', 'abr', 'may', 'jun',
    'jul', 'ago', 'sep', 'oct', 'nov', 'dic',
  ];
  const month = months[date.getMonth()];
  const year = String(date.getFullYear()).slice(-2);
  return `${day}-${month}-${year}`;
}

export function getPeriodReportFileName(
  period: Pick<PeriodHistory, 'startDate' | 'endDate'>
): string {
  return `Reporte periodo ${formatFileDate(period.startDate)} al ${formatFileDate(period.endDate)}.pdf`;
}

function total(items: { amount: number }[]): number {
  return items.reduce((sum, item) => sum + item.amount, 0);
}

function categoryRows(
  categories: PeriodHistoryCategory[],
  expensesTotal: number
): string {
  if (categories.length === 0) {
    return '<div class="empty">No hubo gastos en este período.</div>';
  }

  return categories
    .map((category) => {
      const percentage = expensesTotal > 0
        ? Math.round((category.total / expensesTotal) * 100)
        : 0;
      const safeColor = /^#[0-9a-f]{3,8}$/i.test(category.categoryColor)
        ? category.categoryColor
        : '#95a5a6';

      return `
        <div class="category-row">
          <div class="category-name">
            <span class="dot" style="background:${safeColor}"></span>
            ${escapeHtml(category.categoryName)}
          </div>
          <div class="category-value">${formatCLP(category.total)} · ${percentage}%</div>
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
        <svg class="donut" viewBox="0 0 120 120" role="img" aria-label="Distribución de gastos por categoría">
          <circle cx="60" cy="60" r="${radius}" fill="none" stroke="#e8eeee" stroke-width="18" />
          ${segments}
          <circle cx="60" cy="60" r="31" fill="white" />
        </svg>
        <div class="donut-center">
          <strong>${formatCLP(expensesTotal)}</strong>
          <span>Gastos totales</span>
        </div>
      </div>
    </div>`;
}

function expenseRows(expenses: ExpenseWithCategory[]): string {
  if (expenses.length === 0) {
    return '<tr><td colspan="4" class="empty-cell">No hubo gastos en este período.</td></tr>';
  }

  return expenses
    .map((expense) => {
      const categoryColor = expense.categoryColor && /^#[0-9a-f]{3,8}$/i.test(expense.categoryColor)
        ? expense.categoryColor
        : '#95a5a6';
      const splitNote = expense.originalAmount && expense.splitPercentage
        ? `<div class="row-note">Tu parte: ${expense.splitPercentage}% de ${formatCLP(expense.originalAmount)}</div>`
        : '';
      return `
        <tr>
          <td class="date">${formatShortDate(expense.date)}</td>
          <td><strong>${escapeHtml(expense.name)}</strong>${splitNote}</td>
          <td class="category-cell"><span class="tag" style="border-color:${categoryColor}">${escapeHtml(expense.categoryName ?? 'Sin categoría')}</span></td>
          <td class="amount expense">-${formatCLP(expense.amount)}</td>
        </tr>`;
    })
    .join('');
}

function incomeRows(incomes: Income[]): string {
  if (incomes.length === 0) {
    return '<tr><td colspan="3" class="empty-cell">No hubo ingresos en este período.</td></tr>';
  }

  return incomes
    .map((income) => `
      <tr>
        <td class="date">${formatShortDate(income.date)}</td>
        <td><strong>${escapeHtml(income.name)}</strong></td>
        <td class="amount income">+${formatCLP(income.amount)}</td>
      </tr>`)
    .join('');
}

export function buildPeriodReportHtml(
  period: PeriodHistory,
  expenses: ExpenseWithCategory[],
  incomes: Income[]
): string {
  const expensesTotal = total(expenses);
  const incomesTotal = total(incomes);
  const balance = incomesTotal - expensesTotal;
  const generatedAt = new Intl.DateTimeFormat('es-CL', {
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
        .dot { width: 8px; height: 8px; margin-right: 6px; border-radius: 50%; flex: none; }
        table { width: 100%; border-collapse: separate; border-spacing: 0; overflow: hidden; }
        thead { display: table-header-group; }
        tr { break-inside: avoid; }
        th { padding: 8px 10px; color: ${COLORS.muted}; background: #f3f7f8; border: 0; font-size: 8px; font-weight: 700; letter-spacing: .35px; text-align: left; }
        th:first-child { border-radius: 8px 0 0 8px; }
        th:last-child { border-radius: 0 8px 8px 0; }
        td { padding: 10px; border-bottom: 1px solid #edf2f3; vertical-align: top; }
        td.date, td.category-cell, td.amount { vertical-align: middle; }
        tbody tr:nth-child(even) td { background: #fbfcfc; }
        tbody tr:last-child td { border-bottom: 0; }
        .date { width: 66px; color: ${COLORS.muted}; white-space: nowrap; }
        .amount { width: 115px; font-weight: 800; text-align: right; white-space: nowrap; }
        .tag { display: inline-block; padding: 2px 7px; color: ${COLORS.muted}; background: #edf3f4; border: 1px solid; border-radius: 99px; font-size: 8px; white-space: nowrap; }
        .row-note { margin-top: 2px; color: ${COLORS.muted}; font-size: 8px; }
        .table-total { display: flex; justify-content: flex-end; gap: 15px; padding: 10px 10px 0; font-weight: 750; }
        .empty, .empty-cell { padding: 14px; color: ${COLORS.muted}; text-align: center; }
        .footer { margin-top: 15px; padding-top: 5px; color: #91a0a5; font-size: 7px; text-align: center; }
      </style>
    </head>
    <body>
      <header class="header">
        <div>
          <div class="eyebrow">Reporte financiero</div>
          <div class="brand">Finni<span>App</span></div>
        </div>
        <div>
          <div class="period">${formatReportDate(period.startDate)} - ${formatReportDate(period.endDate)}</div>
          <div class="generated">Generado el ${escapeHtml(generatedAt)}</div>
        </div>
      </header>

      <section class="summary">
        <div class="summary-card">
          <div class="summary-icon income-icon"><svg viewBox="0 0 24 24"><path d="M4 17l6-6 4 4 6-8"/><path d="M15 7h5v5"/></svg></div>
          <div class="summary-copy"><div class="label">Ingresos</div><div class="value income">${formatCLP(incomesTotal)}</div></div>
        </div>
        <div class="summary-card">
          <div class="summary-icon expense-icon"><svg viewBox="0 0 24 24"><path d="M4 7l6 6 4-4 6 8"/><path d="M15 17h5v-5"/></svg></div>
          <div class="summary-copy"><div class="label">Gastos</div><div class="value expense">${formatCLP(expensesTotal)}</div></div>
        </div>
        <div class="summary-card balance">
          <div class="summary-icon"><svg viewBox="0 0 24 24"><path d="M4 7h14a2 2 0 0 1 2 2v9H6a2 2 0 0 1-2-2V7z"/><path d="M4 7l2-3h10l2 3"/><path d="M15 12h5v4h-5a2 2 0 1 1 0-4z"/></svg></div>
          <div class="summary-copy"><div class="label">Saldo del período</div><div class="value">${formatCLP(balance)}</div></div>
        </div>
      </section>

      <section class="section category-section">
        <h2 class="section-title">Resumen de gastos</h2>
        <div class="category-overview">
          ${donutChart(period.categories, expensesTotal)}
          <div class="category-grid">${categoryRows(period.categories, expensesTotal)}</div>
        </div>
      </section>

      <section class="section transactions${expenses.length <= 8 ? ' keep-together' : ''}">
        <h2 class="section-title">Detalle de gastos</h2>
        <div class="section-subtitle">${expenses.length} ${expenses.length === 1 ? 'movimiento' : 'movimientos'}</div>
        <table>
          <thead><tr><th>Fecha</th><th>Descripción</th><th>Categoría</th><th style="text-align:right">Monto</th></tr></thead>
          <tbody>${expenseRows(expenses)}</tbody>
        </table>
        <div class="table-total"><span>Total gastos</span><span class="expense">${formatCLP(expensesTotal)}</span></div>
      </section>

      <section class="section transactions${incomes.length <= 8 ? ' keep-together' : ''}">
        <h2 class="section-title">Detalle de ingresos</h2>
        <div class="section-subtitle">${incomes.length} ${incomes.length === 1 ? 'movimiento' : 'movimientos'}</div>
        <table>
          <thead><tr><th>Fecha</th><th>Descripción</th><th style="text-align:right">Monto</th></tr></thead>
          <tbody>${incomeRows(incomes)}</tbody>
        </table>
        <div class="table-total"><span>Total ingresos</span><span class="income">${formatCLP(incomesTotal)}</span></div>
      </section>

      <footer class="footer">Este reporte fue generado desde FinniApp.</footer>
    </body>
  </html>`;
}

export async function exportPeriodReport(period: PeriodHistory): Promise<void> {
  const { expenses, incomes } = await getPeriodStatement(period.periodId);
  const html = buildPeriodReportHtml(period, expenses, incomes);

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
    dialogTitle: 'Compartir reporte del período',
    mimeType: 'application/pdf',
    UTI: 'com.adobe.pdf',
  });
}
