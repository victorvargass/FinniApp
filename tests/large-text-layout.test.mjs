import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('shared text keeps system scaling within a layout-safe accessibility range', () => {
  const theme = read('constants/theme.ts');
  const themedText = read('components/themed-text.tsx');

  assert.match(theme, /largeTextScale: 1\.2/);
  assert.match(theme, /maxFontSizeMultiplier: 1\.5/);
  assert.match(themedText, /maxFontSizeMultiplier = AccessibilityTokens\.maxFontSizeMultiplier/);
});

test('high-density shared layouts reflow when large text is enabled', () => {
  for (const path of [
    'components/segmented-tabs.tsx',
    'components/expandable-finance-card.tsx',
    'components/home-summary-cards.tsx',
    'components/home-debts-card.tsx',
    'components/home-payment-balances-card.tsx',
    'components/account-movement-list.tsx',
    'app/(tabs)/movements.tsx',
    'app/modal/debts.tsx',
  ]) {
    const source = read(path);
    assert.match(source, /useLargeTextLayout\(\)/, `${path} must react to the system font scale`);
    assert.match(source, /LargeText/, `${path} must provide a reflow style for large text`);
  }
});

test('bottom navigation uses compact fitting labels only for large text', () => {
  const tabs = read('app/(tabs)/_layout.tsx');
  assert.match(tabs, /usesLargeText\s*\?/);
  assert.match(tabs, /adjustsFontSizeToFit/);
  assert.match(tabs, /compactTextMaxFontSizeMultiplier/);
});
