import assert from 'node:assert/strict';
import test from 'node:test';

import { matchesMovementSearchQuery, matchesSearchQuery } from '../lib/search.ts';

test('category search ignores case, accents, and surrounding spaces', () => {
  assert.equal(matchesSearchQuery('Alimentación', '  ALIMENTACION '), true);
  assert.equal(matchesSearchQuery('Colecciones', 'leccio'), true);
  assert.equal(matchesSearchQuery('Conciertos', 'medicamentos'), false);
});

test('an empty category search keeps every option visible', () => {
  assert.equal(matchesSearchQuery('Ahorro', ''), true);
  assert.equal(matchesSearchQuery('Abono', '   '), true);
});

test('movement search matches formatted and unformatted amounts', () => {
  assert.equal(matchesMovementSearchQuery('Panadería', 2750, '2750'), true);
  assert.equal(matchesMovementSearchQuery('Panadería', 2750, '2.750'), true);
  assert.equal(matchesMovementSearchQuery('Panadería', 2750, '$2.750'), true);
  assert.equal(matchesMovementSearchQuery('Panadería', 2750, 'CLP 2.750'), true);
  assert.equal(matchesMovementSearchQuery('Panadería', 2750, '3.750'), false);
  assert.equal(matchesMovementSearchQuery('Panadería 24/7', 2750, 'tienda2750'), false);
});
