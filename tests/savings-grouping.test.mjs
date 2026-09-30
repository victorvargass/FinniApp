import assert from 'node:assert/strict';
import test from 'node:test';

import { getPopulatedSavingsGroups, groupSavingsItems } from '../lib/savings-grouping.ts';

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

test('savings filters omit groups without visible goals', () => {
  const groups = [
    { id: 1, name: 'Con metas', color: '#123456' },
    { id: 2, name: 'Vacío', color: '#654321' },
  ];
  assert.deepEqual(
    getPopulatedSavingsGroups([{ groupId: 1 }], groups, (goal) => goal.groupId).map((group) => group.id),
    [1]
  );
});
