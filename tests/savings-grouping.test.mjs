import assert from 'node:assert/strict';
import test from 'node:test';

import { groupSavingsItems } from '../lib/savings-grouping.ts';

test('goals without a group remain visible and their amounts are unchanged', () => {
  const goals = [
    { id: 1, groupId: 2, amount: 30000 },
    { id: 2, groupId: null, amount: 12000 },
  ];
  const sections = groupSavingsItems(goals, [{ id: 2, name: 'Inversiones', color: '#123456' }],
    (goal) => goal.groupId, 'No especificado');
  assert.deepEqual(sections.map((section) => section.name), ['Inversiones', 'No especificado']);
  assert.equal(sections.flatMap((section) => section.items).reduce((sum, goal) => sum + goal.amount, 0), 42000);
});

test('a deleted group leaves its goals in the unassigned section', () => {
  const sections = groupSavingsItems([{ id: 1, groupId: 7 }], [], (goal) => goal.groupId, 'No especificado');
  assert.deepEqual(sections.map((section) => section.key), ['unassigned']);
});
