import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

const colorSelect = readFileSync(new URL('../components/forms/shared.tsx', import.meta.url), 'utf8');
const colorSelectStyles = readFileSync(new URL('../components/forms/styles.ts', import.meta.url), 'utf8');
const simpleSelect = readFileSync(new URL('../components/simple-select.tsx', import.meta.url), 'utf8');

test('searchable form selectors stay above the keyboard in a bottom sheet', () => {
  assert.match(colorSelect, /KeyboardAvoidingView/);
  assert.match(colorSelect, /Platform\.OS === 'ios' \? 'padding' : 'height'/);
  assert.match(colorSelect, /keyboardShouldPersistTaps="handled"/);
  assert.match(colorSelect, /keyboardDismissMode="on-drag"/);
  assert.match(colorSelectStyles, /selectOverlay: \{ flex: 1, justifyContent: 'flex-end'/);
  assert.match(colorSelectStyles, /selectSheet: \{ maxHeight: '82%', flexShrink: 1 \}/);
});

test('generic searchable selectors use the same keyboard-safe bottom sheet', () => {
  assert.match(simpleSelect, /animationType="slide"/);
  assert.match(simpleSelect, /KeyboardAvoidingView/);
  assert.match(simpleSelect, /Platform\.OS === 'ios' \? 'padding' : 'height'/);
  assert.match(simpleSelect, /keyboardShouldPersistTaps="handled"/);
  assert.match(simpleSelect, /overlay: \{ flex: 1, justifyContent: 'flex-end'/);
  assert.match(simpleSelect, /paddingBottom: Math\.max\(insets\.bottom, 16\) \+ 12/);
});
