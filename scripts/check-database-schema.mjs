import { existsSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const requestedBase = process.argv.includes('--base')
  ? process.argv[process.argv.indexOf('--base') + 1]
  : null;

function readWorkspaceFile(path) {
  return readFileSync(resolve(root, path), 'utf8');
}

function readGitFile(ref, path) {
  return execFileSync('git', ['show', `${ref}:${path}`], {
    cwd: root,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

function resolveBase(ref) {
  if (!ref || /^0+$/.test(ref)) return null;
  try {
    execFileSync('git', ['rev-parse', '--verify', `${ref}^{commit}`], {
      cwd: root,
      stdio: 'ignore',
    });
    return ref;
  } catch {
    // EAS checkout is intentionally shallow. Fetch only the push base commit so
    // the OTA gate can compare both schema contracts without cloning history.
    try {
      execFileSync('git', ['fetch', '--no-tags', '--depth=1', 'origin', ref], {
        cwd: root,
        stdio: 'ignore',
      });
      execFileSync('git', ['rev-parse', '--verify', `${ref}^{commit}`], {
        cwd: root,
        stdio: 'ignore',
      });
      return ref;
    } catch {
      throw new Error(`No se pudo leer el commit base ${ref}. El checkout de CI debe incluir su historial.`);
    }
  }
}

function schemaVersion(source) {
  const match = source.match(/DATABASE_SCHEMA_VERSION\s*=\s*(\d+)/);
  if (!match) throw new Error('No se encontró DATABASE_SCHEMA_VERSION.');
  return Number(match[1]);
}

function migrationVersions(source) {
  return [...source.matchAll(/\{\s*version:\s*(\d+),\s*name:\s*'[^']+'\s*\}/g)]
    .map((match) => Number(match[1]));
}

function initializationContract(dbSource, migrationSource, schemaSource) {
  const start = dbSource.indexOf('async function initializeDatabase(): Promise<void> {');
  const end = dbSource.indexOf('export function initDatabase()', start);
  if (start < 0 || end < 0) throw new Error('No se pudo aislar initializeDatabase para validar el esquema.');

  // The version number itself is metadata, not a schema operation. Everything
  // else in these sections can alter how an existing database is upgraded.
  const schemaWithoutVersion = schemaSource.replace(
    /export const DATABASE_SCHEMA_VERSION\s*=\s*\d+;/,
    ''
  );
  const migrationWithoutRegistry = migrationSource.replace(
    /export const SCHEMA_MIGRATIONS\s*=\s*\[[\s\S]*?\]\s*as const;/,
    ''
  );

  return [dbSource.slice(start, end), migrationWithoutRegistry, schemaWithoutVersion]
    .join('\n')
    .replace(/\r\n/g, '\n')
    .trim();
}

function assertRegistry(version, migrationSource) {
  const versions = migrationVersions(migrationSource);
  if (versions.length === 0) throw new Error('El registro de migraciones está vacío.');
  versions.forEach((value, index) => {
    const expected = index + 1;
    if (value !== expected) {
      throw new Error(`El registro de migraciones debe ser continuo: se esperaba v${expected} y apareció v${value}.`);
    }
  });
  if (versions.at(-1) !== version) {
    throw new Error(`DATABASE_SCHEMA_VERSION=${version}, pero la última migración es v${versions.at(-1)}.`);
  }
  const migrationTest = resolve(root, 'tests', 'schema-migrations', `v${version}.test.mjs`);
  if (!existsSync(migrationTest)) {
    throw new Error(`Falta la prueba de actualización tests/schema-migrations/v${version}.test.mjs.`);
  }
}

const currentSchema = readWorkspaceFile('lib/database-schema.ts');
const currentMigrations = readWorkspaceFile('lib/schema-migrations.ts');
const currentDb = readWorkspaceFile('lib/database/engine.ts');
const currentVersion = schemaVersion(currentSchema);

assertRegistry(currentVersion, currentMigrations);

const base = resolveBase(requestedBase);
if (base) {
  const baseSchema = readGitFile(base, 'lib/database-schema.ts');
  const baseMigrations = readGitFile(base, 'lib/schema-migrations.ts');
  let baseDb;
  try {
    baseDb = readGitFile(base, 'lib/database/engine.ts');
  } catch {
    baseDb = readGitFile(base, 'lib/db.ts');
  }
  const baseVersion = schemaVersion(baseSchema);
  const changed = initializationContract(currentDb, currentMigrations, currentSchema)
    !== initializationContract(baseDb, baseMigrations, baseSchema);

  if (currentVersion < baseVersion) {
    throw new Error(`La versión de base de datos retrocedió de v${baseVersion} a v${currentVersion}.`);
  }
  if (changed && currentVersion <= baseVersion) {
    throw new Error(
      `Cambió la inicialización/migración de la base de datos, pero DATABASE_SCHEMA_VERSION sigue en v${currentVersion}. `
      + `Súbela a v${baseVersion + 1}, agrega la entrada al registro y crea su prueba de actualización.`
    );
  }
  for (let version = baseVersion + 1; version <= currentVersion; version += 1) {
    const migrationTest = resolve(root, 'tests', 'schema-migrations', `v${version}.test.mjs`);
    if (!existsSync(migrationTest)) {
      throw new Error(`La migración v${version} no tiene tests/schema-migrations/v${version}.test.mjs.`);
    }
  }
}

console.log(
  base
    ? `Contrato de base de datos válido: v${currentVersion} (comparado con ${base}).`
    : `Contrato de base de datos válido: v${currentVersion}.`
);
