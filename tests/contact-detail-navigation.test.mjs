import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

const contacts = readFileSync(new URL('../app/modal/contacts.tsx', import.meta.url), 'utf8');
const detail = readFileSync(new URL('../app/modal/contact-detail.tsx', import.meta.url), 'utf8');
const form = readFileSync(new URL('../app/modal/contact-form.tsx', import.meta.url), 'utf8');

test('contact rows open a read-only detail instead of the edit form', () => {
  assert.match(contacts, /pathname: '\/modal\/contact-detail'/);
  assert.doesNotMatch(contacts, /pathname: '\/modal\/contact-form' as never, params: \{ id:/);
});

test('contact detail owns edit and confirmed deletion in its overflow menu', () => {
  assert.match(detail, /<OverflowMenu/);
  assert.match(detail, /label: t\('common\.edit'\)/);
  assert.match(detail, /label: t\('common\.delete'\)/);
  assert.match(detail, /t\('contacts\.deleteHint'\)/);
  assert.doesNotMatch(form, /confirmDelete/);
  assert.doesNotMatch(form, /removeContact/);
});
