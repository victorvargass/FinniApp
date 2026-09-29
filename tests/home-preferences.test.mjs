import assert from 'node:assert/strict';
import test from 'node:test';

import {
  DEFAULT_HOME_PREFERENCES,
  normalizeHomePreferences,
  parseHomePreferences,
} from '../lib/home-preferences.ts';

test('home preferences preserve a valid custom order and append future sections', () => {
  const preferences = normalizeHomePreferences({
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
