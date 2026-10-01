import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const packageJson = JSON.parse(readFileSync('package.json', 'utf8'));
const metroPatch = readFileSync('patches/metro+0.83.3.patch', 'utf8');
const auditGuard = readFileSync('scripts/check-dependency-security.mjs', 'utf8');

test('secure Metro transitive dependencies remain pinned and reproducible', () => {
  assert.equal(packageJson.overrides?.['image-size'], '2.0.4');
  assert.equal(packageJson.overrides?.postcss, '8.5.28');
  assert.equal(packageJson.scripts?.postinstall, 'patch-package');
  assert.equal(packageJson.devDependencies?.['patch-package'], '8.0.1');
  assert.match(metroPatch, /readFileSync\(assetInfo\.files\[0\]\)/);
});

test('the dependency audit has no accepted high-risk exceptions', () => {
  assert.match(auditGuard, /const acceptedHighRiskPackages = new Set\(\);/);
});
