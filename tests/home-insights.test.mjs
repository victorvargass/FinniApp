import assert from 'node:assert/strict';
import test from 'node:test';

import {
  findMostUrgentCategoryLimit,
} from '../lib/home-insights.ts';

test('most urgent category limit selects the highest ratio above threshold', () => {
  const urgent = findMostUrgentCategoryLimit([
    { categoryId: 1, categoryName: 'Food', periodLimit: 100_000, total: 82_000 },
    { categoryId: 2, categoryName: 'Travel', periodLimit: 200_000, total: 210_000 },
    { categoryId: 3, categoryName: 'Health', periodLimit: null, total: 20_000 },
  ]);
  assert.equal(urgent?.categoryName, 'Travel');
  assert.equal(urgent?.ratio, 1.05);
});

test('category limit insight remains quiet below its threshold', () => {
  assert.equal(findMostUrgentCategoryLimit([
    { categoryId: 1, categoryName: 'Food', periodLimit: 100_000, total: 79_999 },
    { categoryId: 2, categoryName: 'No limit', periodLimit: null, total: 500_000 },
  ]), null);
});

test('category limit insight includes the exact threshold', () => {
  assert.equal(findMostUrgentCategoryLimit([
    { categoryId: 1, categoryName: 'Food', periodLimit: 100_000, total: 80_000 },
  ])?.categoryName, 'Food');
});
