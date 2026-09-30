import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const root = process.cwd();
const matrix = JSON.parse(readFileSync(path.join(root, 'tests/regression-matrix.json'), 'utf8'));
function routeFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) return routeFiles(absolute);
    if (!entry.name.endsWith('.tsx') || entry.name === '_layout.tsx') return [];
    return [path.relative(root, absolute).replaceAll('\\', '/')];
  });
}

test('every application route belongs to one regression journey', () => {
  const actual = routeFiles(path.join(root, 'app')).sort();
  const declared = matrix.journeys.flatMap((journey) => journey.routes).sort();
  assert.deepEqual(declared, actual);
});

test('journey identifiers and route ownership are unique', () => {
  const ids = matrix.journeys.map((journey) => journey.id);
  const routes = matrix.journeys.flatMap((journey) => journey.routes);
  assert.equal(new Set(ids).size, ids.length);
  assert.equal(new Set(routes).size, routes.length);
});

test('all regression artifacts exist and critical journeys include an E2E flow', () => {
  for (const journey of matrix.journeys) {
    assert.ok(journey.automatedArtifacts.length > 0, `${journey.id} has no automated coverage`);
    for (const artifact of journey.automatedArtifacts) {
      assert.ok(existsSync(path.join(root, artifact)), `${journey.id} references missing ${artifact}`);
    }
    if (journey.priority === 'critical') {
      assert.ok(
        journey.automatedArtifacts.some((artifact) => artifact.startsWith('.maestro/')),
        `${journey.id} must include an E2E flow`
      );
    }
    if (journey.priority === 'external') {
      assert.ok(journey.manualReason, `${journey.id} must explain its external dependency`);
    }
  }
});

test('automated regression workflows execute every credential-free Maestro flow', () => {
  const workflows = [
    readFileSync(path.join(root, '.eas/workflows/e2e-test-android.yml'), 'utf8'),
    readFileSync(path.join(root, '.github/workflows/e2e-android.yml'), 'utf8'),
  ];
  const expected = new Set(
    matrix.journeys
      .filter((journey) => journey.priority !== 'external')
      .flatMap((journey) => journey.automatedArtifacts)
      .filter((artifact) => artifact.startsWith('.maestro/'))
  );
  for (const workflow of workflows) {
    for (const flow of expected) {
      const journey = matrix.journeys.find((item) => item.automatedArtifacts.includes(flow));
      if (workflow === workflows[0] && journey?.githubOnly) continue;
      assert.match(workflow, new RegExp(flow.replaceAll('.', '\\.')));
    }
  }
});

test('GitHub executes platform-only upgrade journeys with a populated fixture', () => {
  const workflow = readFileSync(path.join(root, '.github/workflows/e2e-android.yml'), 'utf8');
  for (const journey of matrix.journeys.filter((item) => item.githubOnly)) {
    for (const artifact of journey.automatedArtifacts.filter((item) => item.startsWith('.maestro/'))) {
      assert.match(workflow, new RegExp(artifact.replaceAll('.', '\\.')));
    }
  }
  assert.match(workflow, /create-upgrade-fixture\.mjs/);
  assert.match(workflow, /run-as com\.vitoco18\.FinniApp cp/);
});

test('the distributable GitHub workflow waits for Android E2E', () => {
  const workflow = readFileSync(path.join(root, '.github/workflows/build.yml'), 'utf8');
  assert.match(workflow, /e2e:\s*\n\s*uses: \.\/\.github\/workflows\/e2e-android\.yml/);
  assert.match(workflow, /needs: e2e/);
});

test('Android E2E distinguishes Maestro failures from emulator cleanup failures', () => {
  const workflow = readFileSync(path.join(root, '.github/workflows/e2e-android.yml'), 'utf8');
  assert.match(workflow, /MODE="0666"/);
  assert.match(workflow, /disable-linux-hw-accel: false/);
  assert.match(workflow, /continue-on-error: true/);
  assert.match(workflow, /touch "\$RUNNER_TEMP\/finniapp-maestro-passed"/);
  assert.match(workflow, /if \[\[ ! -f "\$RUNNER_TEMP\/finniapp-maestro-passed" \]\]/);
});

test('the preview update workflow uses the Node version required by the test suite', () => {
  const packageJson = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8'));
  const workflow = readFileSync(path.join(root, '.eas/workflows/publish-preview-update.yml'), 'utf8');
  assert.equal(packageJson.engines.node, '>=22.14.0');
  assert.match(workflow, /defaults:\s*\n\s*tools:\s*\n\s*node: ['"]22\.14\.0['"]/);
});
