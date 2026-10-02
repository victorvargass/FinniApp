import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

const screen = readFileSync(new URL('../app/modal/global-search.tsx', import.meta.url), 'utf8');
const home = readFileSync(new URL('../app/(tabs)/home.tsx', import.meta.url), 'utf8');
const es = readFileSync(new URL('../locales/es.ts', import.meta.url), 'utf8');

test('global search keeps its placeholder on one vertically centered line', () => {
  assert.match(screen, /multiline=\{false\}/);
  assert.match(screen, /numberOfLines=\{1\}/);
  assert.match(screen, /textAlignVertical="center"/);
  assert.match(screen, /input: \{[^}]*height: 50[^}]*paddingVertical: 0/);
  assert.match(es, /placeholder: 'Buscar movimientos, contactos y más'/);
});

test('the Home search shortcut uses the same single-line text', () => {
  assert.match(home, /testID="home-global-search"[\s\S]*ellipsizeMode="tail"[\s\S]*numberOfLines=\{1\}[\s\S]*t\('globalSearch\.placeholder'\)/);
  assert.match(home, /hiddenSections\.includes\('search'\)[\s\S]*renderHomeSection\('search'\)/);
});
