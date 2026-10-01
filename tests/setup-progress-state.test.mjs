import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import {
  DEFAULT_CATEGORY_COUNT,
  hasUserCreatedCategory,
} from '../lib/setup-progress-state.ts';

test('freshly seeded categories do not complete the additional category step', () => {
  const seededCategories = Array.from(
    { length: DEFAULT_CATEGORY_COUNT },
    (_, index) => ({ id: index + 1 })
  );

  assert.equal(hasUserCreatedCategory(seededCategories), false);
});

test('a category created after the defaults completes the setup step', () => {
  assert.equal(hasUserCreatedCategory([{ id: DEFAULT_CATEGORY_COUNT + 1 }]), true);
});

test('deleting a default does not hide a later user-created category', () => {
  assert.equal(hasUserCreatedCategory([{ id: 1 }, { id: DEFAULT_CATEGORY_COUNT + 1 }]), true);
});

test('the setup baseline matches the categories seeded by a clean database', () => {
  const databaseSource = readFileSync(
    new URL('../lib/database/engine.ts', import.meta.url),
    'utf8'
  );
  const defaultBlock = databaseSource.match(
    /const DEFAULT_CATEGORIES:[\s\S]*?= \[([\s\S]*?)\n\];/
  )?.[1];

  assert.ok(defaultBlock, 'DEFAULT_CATEGORIES must remain discoverable');
  const seededCount = defaultBlock.match(/database\.defaultCategories\./g)?.length ?? 0;
  assert.equal(seededCount, DEFAULT_CATEGORY_COUNT);
});
