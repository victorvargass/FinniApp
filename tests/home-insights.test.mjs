import assert from 'node:assert/strict';
import test from 'node:test';

import {
  calculateDailyAvailable,
  findMostUrgentCategoryLimit,
  getRemainingPeriodDays,
} from '../lib/home-insights.ts';

test('remaining period days includes today and never returns zero', () => {
  assert.equal(getRemainingPeriodDays('2026-09-15', new Date(2026, 8, 11)), 5);
  assert.equal(getRemainingPeriodDays('2026-09-10', new Date(2026, 8, 11)), 1);
});

test('daily available divides a positive balance across remaining days', () => {
  assert.equal(calculateDailyAvailable(100_000, '2026-09-15', new Date(2026, 8, 11)), 20_000);
  assert.equal(calculateDailyAvailable(-10_000, '2026-09-15', new Date(2026, 8, 11)), 0);
});

test('most urgent category limit selects the highest ratio above threshold', () => {
  const urgent = findMostUrgentCategoryLimit([
    { categoryId: 1, categoryName: 'Food', periodLimit: 100_000, total: 82_000 },
    { categoryId: 2, categoryName: 'Travel', periodLimit: 200_000, total: 210_000 },
    { categoryId: 3, categoryName: 'Health', periodLimit: null, total: 20_000 },
  ]);
  assert.equal(urgent?.categoryName, 'Travel');
  assert.equal(urgent?.ratio, 1.05);
});
