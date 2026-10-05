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
    [
      readFileSync(path.join(root, '.github/workflows/e2e-android.yml'), 'utf8'),
      readFileSync(path.join(root, 'scripts/run-android-e2e.sh'), 'utf8'),
    ].join('\n'),
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
  const workflow = [
    readFileSync(path.join(root, '.github/workflows/e2e-android.yml'), 'utf8'),
    readFileSync(path.join(root, 'scripts/run-android-e2e.sh'), 'utf8'),
  ].join('\n');
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
  const e2eWorkflow = readFileSync(path.join(root, '.github/workflows/e2e-android.yml'), 'utf8');
  assert.match(workflow, /e2e:\s*\n\s*uses: \.\/\.github\/workflows\/e2e-android\.yml/);
  assert.match(workflow, /needs: e2e/);
  assert.match(e2eWorkflow, /group: android-e2e-\$\{\{ github\.workflow \}\}-\$\{\{ github\.ref \}\}/);
});

test('Android E2E distinguishes Maestro failures from emulator cleanup failures', () => {
  const workflow = readFileSync(path.join(root, '.github/workflows/e2e-android.yml'), 'utf8');
  const runner = readFileSync(path.join(root, 'scripts/run-android-e2e.sh'), 'utf8');
  assert.match(workflow, /MODE="0666"/);
  assert.match(workflow, /disable-linux-hw-accel: false/);
  assert.match(workflow, /continue-on-error: true/);
  assert.match(workflow, /script: bash scripts\/run-android-e2e\.sh/);
  assert.match(workflow, /runner\.temp.*metro\.log/);
  assert.match(runner, /set -euo pipefail/);
  assert.match(runner, /EXPO_PUBLIC_E2E_LANGUAGE=es/);
  assert.match(runner, /EXPO_PUBLIC_E2E_DISABLE_FEATURE_GUIDES=1/);
  assert.match(runner, /EXPO_PUBLIC_E2E_DISABLE_LOGBOX=1/);
  assert.match(runner, /expo start --dev-client --localhost/);
  assert.match(runner, /packager-status:running/);
  assert.match(runner, /adb reverse tcp:8081 tcp:8081/);
  assert.match(runner, /settings put global hide_error_dialogs 1/);
  assert.match(runner, /android\.intent\.action\.CLOSE_SYSTEM_DIALOGS/);
  assert.match(runner, /touch "\$RUNNER_TEMP\/finniapp-maestro-passed"/);
  assert.match(workflow, /if \[\[ ! -f "\$RUNNER_TEMP\/finniapp-maestro-passed" \]\]/);
});

test('Android E2E language override is isolated from normal device language detection', () => {
  const i18n = readFileSync(path.join(root, 'lib/i18n.ts'), 'utf8');
  assert.match(i18n, /process\.env\.EXPO_PUBLIC_E2E_LANGUAGE/);
  assert.match(i18n, /e2eLanguage === 'es' \|\| e2eLanguage === 'en'/);
  assert.match(i18n, /getLocales\(\)\[0\]\?\.languageCode/);
});

test('Android E2E feature-guide override is isolated from normal application builds', () => {
  const featureGuide = readFileSync(path.join(root, 'components/feature-guide.tsx'), 'utf8');
  assert.match(featureGuide, /process\.env\.EXPO_PUBLIC_E2E_DISABLE_FEATURE_GUIDES === '1'/);
  assert.match(featureGuide, /if \(FEATURE_GUIDES_DISABLED_FOR_E2E\) return/);
  assert.match(featureGuide, /if \(!FEATURE_GUIDES_DISABLED_FOR_E2E\) setVisible\(true\)/);
});

test('Android E2E hides the development LogBox overlay without dropping Metro logs', () => {
  const layout = readFileSync(path.join(root, 'app/_layout.tsx'), 'utf8');
  const runner = readFileSync(path.join(root, 'scripts/run-android-e2e.sh'), 'utf8');
  assert.match(layout, /__DEV__ && process\.env\.EXPO_PUBLIC_E2E_DISABLE_LOGBOX === '1'/);
  assert.match(layout, /LogBox\.ignoreAllLogs\(\)/);
  assert.match(runner, /> "\$RUNNER_TEMP\/metro\.log" 2>&1/);
});

test('Android E2E follows read-only details and overflow actions', () => {
  const smoke = readFileSync(path.join(root, '.maestro/smoke-financial.yml'), 'utf8');
  const debt = readFileSync(path.join(root, '.maestro/debt-partial-payment.yml'), 'utf8');

  assert.match(smoke, /tapOn: 'Movimiento para cierre'\s+- assertVisible: 'Detalle del gasto'/);
  assert.match(smoke, /tapOn: 'Administrar período'\s+- tapOn: 'Cerrar período'/);
  assert.doesNotMatch(smoke, /id: 'period-close'|assertVisible: 'Editar gasto'/);
  assert.match(debt, /tapOn: 'Más opciones'\s+- tapOn: 'Registrar pago'/);
});

test('the preview update workflow uses the Node version required by the test suite', () => {
  const packageJson = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8'));
  const workflow = readFileSync(path.join(root, '.eas/workflows/publish-preview-update.yml'), 'utf8');
  assert.equal(packageJson.engines.node, '>=22.14.0');
  assert.match(workflow, /defaults:\s*\n\s*tools:\s*\n\s*node: ['"]22\.14\.0['"]/);
  assert.match(workflow, /update_preview:[\s\S]*?environment: preview[\s\S]*?channel: preview/);
});

test('iOS simulator workflow builds a simulator app and runs critical journeys', () => {
  const workflow = readFileSync(path.join(root, '.eas/workflows/e2e-test-ios.yml'), 'utf8');
  assert.match(workflow, /platform: ios/);
  assert.match(workflow, /profile: e2e-test/);
  for (const flow of [
    '.maestro/onboarding-full.yml',
    '.maestro/smoke-financial.yml',
    '.maestro/debt-partial-payment.yml',
    '.maestro/credit-installment-reconciliation.yml',
    '.maestro/settings-and-localization.yml',
  ]) assert.match(workflow, new RegExp(flow.replaceAll('.', '\\.')));
});
