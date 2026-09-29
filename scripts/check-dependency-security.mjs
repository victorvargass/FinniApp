import { spawnSync } from 'node:child_process';

const acceptedHighRiskPackages = new Set(['image-size', 'postcss']);
const isWindows = process.platform === 'win32';
const auditCommand = isWindows
  ? [process.env.ComSpec ?? 'cmd.exe', ['/d', '/s', '/c', 'npm audit --omit=dev --json']]
  : ['npm', ['audit', '--omit=dev', '--json']];
const result = spawnSync(auditCommand[0], auditCommand[1], {
  encoding: 'utf8',
  shell: false,
});

if (result.error || !result.stdout?.trim()) {
  console.error('No se pudo obtener el informe JSON de npm audit.');
  if (result.error) console.error(result.error.message);
  if (result.stderr) console.error(result.stderr.trim());
  process.exit(1);
}

let report;
try {
  report = JSON.parse(result.stdout);
} catch {
  console.error('npm audit no devolvió un informe JSON válido.');
  process.exit(1);
}

const vulnerabilities = Object.values(report.vulnerabilities ?? {});
const critical = vulnerabilities.filter((item) => item.severity === 'critical');
const unexpectedHigh = vulnerabilities.filter(
  (item) => item.severity === 'high' && !acceptedHighRiskPackages.has(item.name)
);
const acceptedHigh = vulnerabilities.filter(
  (item) => item.severity === 'high' && acceptedHighRiskPackages.has(item.name)
);

if (critical.length > 0 || unexpectedHigh.length > 0) {
  console.error('La auditoría detectó riesgos críticos o altos no aceptados:');
  for (const item of [...critical, ...unexpectedHigh]) {
    console.error(`- ${item.name}: ${item.severity}`);
  }
  process.exit(1);
}

const totals = report.metadata?.vulnerabilities ?? {};
console.log(
  `Auditoría controlada: ${totals.total ?? vulnerabilities.length} alertas; `
  + `${acceptedHigh.length} altas aceptadas temporalmente y 0 críticas.`
);
