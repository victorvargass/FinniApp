import assert from 'node:assert/strict';
import test from 'node:test';

import { compareVersions, evaluateStoreUpdate } from '../lib/store-update-policy.ts';

const policy = {
  latestVersion: '1.6.0',
  minimumVersion: '1.5.0',
  storeUrl: 'https://play.google.com/store/apps/details?id=com.vitoco18.FinniApp',
};

test('compares dotted application versions numerically', () => {
  assert.equal(compareVersions('1.10.0', '1.9.9'), 1);
  assert.equal(compareVersions('1.4', '1.4.0'), 0);
  assert.equal(compareVersions('1.4.0', '1.4.1'), -1);
});

test('marks a Play Store update as required below the minimum version', () => {
  assert.deepEqual(evaluateStoreUpdate('1.4.0', policy), {
    kind: 'available',
    latestVersion: '1.6.0',
    required: true,
    storeUrl: policy.storeUrl,
  });
});

test('allows postponing a newer version above the minimum version', () => {
  assert.deepEqual(evaluateStoreUpdate('1.5.0', policy), {
    kind: 'available',
    latestVersion: '1.6.0',
    required: false,
    storeUrl: policy.storeUrl,
  });
});

test('does not prompt when the installed version is current', () => {
  assert.deepEqual(evaluateStoreUpdate('1.6.0', policy), { kind: 'current' });
});
