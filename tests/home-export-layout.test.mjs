import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../app/(tabs)/home.tsx', import.meta.url), 'utf8');
const csvSource = readFileSync(
  new URL('../app/modal/period-csv-export.tsx', import.meta.url),
  'utf8',
);

test('period exports use compact colored icon buttons beside the heading', () => {
  const titleIndex = source.indexOf("t('historicalPeriod.exportTitle')");
  const actionsIndex = source.indexOf('styles.exportActions');
  assert.ok(titleIndex >= 0 && titleIndex < actionsIndex);
  assert.match(source, /accessibilityLabel=\{t\('historicalPeriod\.exportPdf'\)\}/);
  assert.match(source, /name="document-text-outline"/);
  assert.match(source, /pdfExportButton: \{ backgroundColor: '#C93F4B' \}/);
  assert.match(source, /accessibilityLabel=\{t\('historicalPeriod\.exportCsv'\)\}/);
  assert.match(source, /name="grid-outline"/);
  assert.match(source, /csvExportButton: \{ backgroundColor: '#168A5B' \}/);
  assert.doesNotMatch(source, /historicalPeriod\.exportPdfShort|historicalPeriod\.exportCsvShort/);
});

test('PDF and CSV expose a loading indicator while the file is generated', () => {
  assert.match(source, /accessibilityState=\{\{ busy: isExporting, disabled: isExporting \}\}/);
  assert.match(source, /isExporting \? \([\s\S]*?<ActivityIndicator/);

  assert.match(csvSource, /busy: exporting/);
  assert.match(csvSource, /\{exporting && <ActivityIndicator/);
  assert.match(csvSource, /exporting \? t\('csv\.exporting'\) : t\('csv\.export'\)/);
});
