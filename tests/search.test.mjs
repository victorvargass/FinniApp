import assert from 'node:assert/strict';
import test from 'node:test';

import { matchesSearchQuery } from '../lib/search.ts';

test('category search ignores case, accents, and surrounding spaces', () => {
  assert.equal(matchesSearchQuery('Alimentación', '  ALIMENTACION '), true);
  assert.equal(matchesSearchQuery('Colecciones', 'leccio'), true);
  assert.equal(matchesSearchQuery('Conciertos', 'medicamentos'), false);
});

test('an empty category search keeps every option visible', () => {
  assert.equal(matchesSearchQuery('Ahorro', ''), true);
  assert.equal(matchesSearchQuery('Abono', '   '), true);
});
