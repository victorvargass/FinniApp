import { File, Paths } from 'expo-file-system';
import { getContentUriAsync } from 'expo-file-system/legacy';
import * as IntentLauncher from 'expo-intent-launcher';
import * as Print from 'expo-print';
import { Platform } from 'react-native';
import * as Sharing from 'expo-sharing';

import { formatCLP } from '@/lib/format';
import type { HistoricalReport } from '@/lib/historical-report';
import { t } from '@/lib/i18n';

const ANDROID_GRANT_READ_URI_PERMISSION = 1;

function safeFilePart(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9-]+/g, '-');
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function csvCell(value: string | number): string {
  const text = String(value);
  const safe = /^[=+\-@]/.test(text) ? `'${text}` : text;
  return `"${safe.replaceAll('"', '""')}"`;
}

export function buildHistoricalReportHtml(report: HistoricalReport, scopeLabel: string): string {
  const categoryRows = report.categories.slice(0, 10).map((category) => `
    <tr><td>${escapeHtml(category.categoryName)}</td><td>${formatCLP(category.total)}</td></tr>
  `).join('');
  const periodRows = [...report.periods].reverse().map((period) => `
    <tr>
      <td>${escapeHtml(period.startDate)} – ${escapeHtml(period.endDate)}</td>
      <td>${formatCLP(period.incomesTotal)}</td>
      <td>${formatCLP(period.expenseTotal)}</td>
      <td class="${period.cashflow >= 0 ? 'positive' : 'negative'}">${formatCLP(period.cashflow)}</td>
    </tr>
  `).join('');

  return `<!doctype html><html><head><meta charset="utf-8"><style>
    @page { margin: 28px; } body { font-family: Arial, sans-serif; color: #0B315B; }
    h1 { margin-bottom: 4px; } .muted { color: #60758E; } .grid { display: flex; gap: 10px; flex-wrap: wrap; margin: 22px 0; }
    .metric { width: 44%; padding: 12px; border: 1px solid #D8E1E8; border-radius: 10px; }
    .metric strong { display: block; font-size: 20px; margin-top: 5px; } table { width: 100%; border-collapse: collapse; margin: 10px 0 22px; }
    th, td { text-align: left; padding: 8px; border-bottom: 1px solid #D8E1E8; } th { background: #E8F9F6; }
    .positive { color: #168A5B; } .negative { color: #C93F4B; } h2 { margin-top: 24px; }
  </style></head><body>
    <h1>${escapeHtml(t('history.summary'))}</h1><div class="muted">${escapeHtml(scopeLabel)}</div>
    <div class="grid">
      <div class="metric">${escapeHtml(t('history.income'))}<strong class="positive">${formatCLP(report.incomeTotal)}</strong></div>
      <div class="metric">${escapeHtml(t('history.outflows'))}<strong class="negative">${formatCLP(report.expenseTotal)}</strong></div>
      <div class="metric">${escapeHtml(t('history.cashflow'))}<strong class="${report.cashflowTotal >= 0 ? 'positive' : 'negative'}">${formatCLP(report.cashflowTotal)}</strong></div>
      <div class="metric">${escapeHtml(t('history.savingsContributions'))}<strong>${formatCLP(report.savingsFundingTotal)}</strong></div>
    </div>
    <h2>${escapeHtml(t('history.activity'))}</h2>
    <table><tbody>
      <tr><td>${escapeHtml(t('history.debtPayments'))}</td><td>${formatCLP(report.debtPaymentsTotal)}</td></tr>
      <tr><td>${escapeHtml(t('history.debtCollections'))}</td><td>${formatCLP(report.debtCollectionsTotal)}</td></tr>
      <tr><td>${escapeHtml(t('history.savingsWithdrawals'))}</td><td>${formatCLP(report.savingsWithdrawalTotal)}</td></tr>
      <tr><td>${escapeHtml(t('history.averagePerPeriod'))}</td><td>${formatCLP(report.averageExpense)}</td></tr>
    </tbody></table>
    <h2>${escapeHtml(t('history.topCategories'))}</h2><table><tbody>${categoryRows}</tbody></table>
    <h2>${escapeHtml(t('history.periods'))}</h2>
    <table><thead><tr><th>${escapeHtml(t('history.period'))}</th><th>${escapeHtml(t('history.income'))}</th><th>${escapeHtml(t('history.outflows'))}</th><th>${escapeHtml(t('history.cashflow'))}</th></tr></thead><tbody>${periodRows}</tbody></table>
  </body></html>`;
}

export async function exportHistoricalReportPdf(
  report: HistoricalReport,
  scopeLabel: string
): Promise<void> {
  const html = buildHistoricalReportHtml(report, scopeLabel);
  if (Platform.OS === 'web') {
    await Print.printAsync({ html });
    return;
  }
  const { uri } = await Print.printToFileAsync({ html });
  const temporaryFile = new File(uri);
  const namedFile = new File(Paths.cache, `finniapp-historico-${safeFilePart(scopeLabel)}.pdf`);
  if (namedFile.exists) namedFile.delete();
  temporaryFile.move(namedFile);

  if (Platform.OS === 'android') {
    const contentUri = await getContentUriAsync(namedFile.uri);
    try {
      await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
        data: contentUri,
        flags: ANDROID_GRANT_READ_URI_PERMISSION,
        type: 'application/pdf',
      });
    } catch {
      await Print.printAsync({ uri: namedFile.uri });
    }
  } else {
    await Print.printAsync({ uri: namedFile.uri });
  }
}

export async function exportHistoricalReportCsv(
  report: HistoricalReport,
  scopeLabel: string
): Promise<void> {
  const header = [
    t('history.period'), t('history.income'), t('history.outflows'), t('history.cashflow'),
    t('history.savingsContributions'), t('history.savingsWithdrawals'),
    t('history.debtPayments'), t('history.debtCollections'),
  ].map(csvCell).join(',');
  const rows = report.periods.map((period) => [
    `${period.startDate} - ${period.endDate}`,
    period.incomesTotal,
    period.expenseTotal,
    period.cashflow,
    period.savingsFundingTotal,
    period.savingsWithdrawalTotal,
    period.debtPaymentsTotal,
    period.debtCollectionsTotal,
  ].map(csvCell).join(','));
  const csv = `\uFEFF${[header, ...rows].join('\r\n')}`;
  const fileName = `finniapp-historico-${safeFilePart(scopeLabel)}.csv`;

  if (Platform.OS === 'web') {
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = fileName;
    anchor.click();
    URL.revokeObjectURL(url);
    return;
  }

  const file = new File(Paths.cache, fileName);
  if (file.exists) file.delete();
  file.create();
  file.write(csv);
  if (!await Sharing.isAvailableAsync()) throw new Error(t('csv.sharingUnavailable'));
  await Sharing.shareAsync(file.uri, {
    dialogTitle: t('history.shareTitle'),
    mimeType: Platform.OS === 'android' ? 'application/vnd.ms-excel' : 'text/csv',
    UTI: 'public.comma-separated-values-text',
  });
}
