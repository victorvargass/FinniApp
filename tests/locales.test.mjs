import assert from 'node:assert/strict';
import test from 'node:test';

import en from '../locales/en.ts';
import es from '../locales/es.ts';

function flatten(value, prefix = '') {
  return Object.entries(value).flatMap(([key, child]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    return typeof child === 'string' ? [[path, child]] : flatten(child, path);
  });
}

function placeholders(value) {
  return [...value.matchAll(/%\{([^}]+)\}/g)].map((match) => match[1]).sort();
}

test('English and Spanish locales have the same translation keys', () => {
  const englishKeys = flatten(en).map(([key]) => key).sort();
  const spanishKeys = flatten(es).map(([key]) => key).sort();

  assert.deepEqual(englishKeys, spanishKeys);
});

test('translations are non-empty and preserve interpolation placeholders', () => {
  const english = new Map(flatten(en));

  for (const [key, spanishValue] of flatten(es)) {
    const englishValue = english.get(key);
    assert.ok(englishValue?.trim(), `Missing English translation for ${key}`);
    assert.deepEqual(
      placeholders(englishValue),
      placeholders(spanishValue),
      `Interpolation placeholders differ for ${key}`,
    );
  }
});
