import { File, Paths } from 'expo-file-system';
import { Platform } from 'react-native';
import * as Sharing from 'expo-sharing';

import { getPeriodStatement } from '@/lib/db';
import { APP_LOCALE, t } from '@/lib/i18n';
import { buildPeriodCsv, type PeriodCsvField } from '@/lib/period-csv';
import type { PeriodHistory } from '@/lib/types';

function fileDate(value: string): string {
  return value.replaceAll('-', '');
}

export function getPeriodCsvFileName(period: Pick<PeriodHistory, 'startDate' | 'endDate'>): string {
  return `finniapp-${fileDate(period.startDate)}-${fileDate(period.endDate)}.csv`;
}

export async function exportPeriodCsv(
  period: Pick<PeriodHistory, 'periodId' | 'startDate' | 'endDate'>,
  fields: PeriodCsvField[]
): Promise<void> {
  const statement = await getPeriodStatement(period.periodId);
  const csv = buildPeriodCsv(statement, fields, {
    headers: {
      date: t('csv.fields.date'),
      time: t('csv.fields.time'),
      type: t('csv.fields.type'),
      name: t('csv.fields.name'),
      category: t('csv.fields.category'),
      paymentMethod: t('csv.fields.paymentMethod'),
      amount: t('csv.fields.amount'),
    },
    expense: t('csv.expense'),
    income: t('csv.income'),
    uncategorized: t('common.notSpecified'),
    noPaymentMethod: t('csv.noPaymentMethod'),
  });
  const fileName = getPeriodCsvFileName(period);

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
  // Excel on Android needs the BOM to recognize UTF-8 accents correctly.
  file.write(`\uFEFF${csv}`);

  if (!await Sharing.isAvailableAsync()) {
    throw new Error(t('csv.sharingUnavailable'));
  }
  await Sharing.shareAsync(file.uri, {
    dialogTitle: t('csv.shareTitle'),
    mimeType: Platform.OS === 'android' ? 'application/vnd.ms-excel' : 'text/csv',
    UTI: 'public.comma-separated-values-text',
  });
}
