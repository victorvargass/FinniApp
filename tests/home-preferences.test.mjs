import assert from 'node:assert/strict';
import test from 'node:test';

import {
  DEFAULT_HOME_PREFERENCES,
  normalizeHomePreferences,
  parseHomePreferences,
} from '../lib/home-preferences.ts';

test('home preferences preserve a valid custom order and append future sections', () => {
  const preferences = normalizeHomePreferences({
    version: DEFAULT_HOME_PREFERENCES.version,
    sectionOrder: ['debts', 'wallet'],
    hiddenSections: ['weekly', 'invalid'],
    periodMetrics: ['available', 'expenses'],
    globalMetrics: ['savings'],
  });

  assert.deepEqual(preferences.sectionOrder.slice(0, 2), ['debts', 'wallet']);
  assert.equal(new Set(preferences.sectionOrder).size, DEFAULT_HOME_PREFERENCES.sectionOrder.length);
  assert.deepEqual(preferences.hiddenSections, ['weekly']);
  assert.deepEqual(preferences.periodMetrics, ['available', 'expenses']);
  assert.deepEqual(preferences.globalMetrics, ['savings']);
});

test('legacy preferences receive billed credit once and can later hide it', () => {
  const migrated = normalizeHomePreferences({
    sectionOrder: ['attention'],
    periodMetrics: ['available'],
    globalMetrics: ['wallet'],
  });
  assert.equal(migrated.version, DEFAULT_HOME_PREFERENCES.version);
  assert.deepEqual(migrated.globalMetrics, ['wallet', 'billedCredit']);

  const customized = normalizeHomePreferences({ ...migrated, globalMetrics: ['wallet'] });
  assert.deepEqual(customized.globalMetrics, ['wallet']);
});

test('legacy preferences receive the global search first and may hide it later', () => {
  const migrated = normalizeHomePreferences({
    version: 2,
    sectionOrder: ['debts', 'wallet'],
    hiddenSections: [],
    periodMetrics: ['available'],
    globalMetrics: ['wallet', 'billedCredit'],
  });
  assert.equal(migrated.sectionOrder[0], 'search');
  assert.deepEqual(migrated.sectionOrder.slice(1, 3), ['debts', 'wallet']);

  const customized = normalizeHomePreferences({ ...migrated, hiddenSections: ['search'] });
  assert.deepEqual(customized.hiddenSections, ['search']);
});

test('home preferences recover safely from corrupt or empty selections', () => {
  assert.deepEqual(parseHomePreferences('not-json'), DEFAULT_HOME_PREFERENCES);
  const preferences = normalizeHomePreferences({
    sectionOrder: [],
    periodMetrics: [],
    globalMetrics: [],
  });
  assert.deepEqual(preferences.sectionOrder, DEFAULT_HOME_PREFERENCES.sectionOrder);
  assert.deepEqual(preferences.periodMetrics, DEFAULT_HOME_PREFERENCES.periodMetrics);
  assert.deepEqual(preferences.globalMetrics, DEFAULT_HOME_PREFERENCES.globalMetrics);
});
