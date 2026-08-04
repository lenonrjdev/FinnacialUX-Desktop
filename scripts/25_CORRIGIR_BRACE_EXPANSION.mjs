import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const SAFE_OVERRIDES = Object.freeze({
  'brace-expansion@1': '1.1.18',
  'brace-expansion@2': '2.1.4',
  'brace-expansion@3': '3.0.6',
  'brace-expansion@4': '5.0.9',
  'brace-expansion@5': '5.0.9',
});

function getArgument(name, fallback = undefined) {
  const index = process.argv.indexOf(name);
  if (index === -1 || index + 1 >= process.argv.length) {
    return fallback;
  }

  return process.argv[index + 1];
}

function normalizePath(value) {
  return String(value).replaceAll('\\', '/');
}

function isBraceExpansionLockPath(lockPath) {
  return /(^|\/)node_modules\/brace-expansion$/u.test(normalizePath(lockPath));
}

function parseVersion(version) {
  const match = String(version).trim().match(/^(\d+)\.(\d+)\.(\d+)(?:[-+].*)?$/u);
  if (!match) {
    throw new Error(`Versao semver invalida de brace-expansion: ${version}`);
  }

  return match.slice(1).map(Number);
}

function compareVersions(left, right) {
  const a = parseVersion(left);
  const b = parseVersion(right);

  for (let index = 0; index < 3; index += 1) {
    if (a[index] !== b[index]) {
      return a[index] < b[index] ? -1 : 1;
    }
  }

  return 0;
}

function isVulnerable(version) {
  const [major] = parseVersion(version);

  if (major < 1) return true;
  if (major === 1) return compareVersions(version, '1.1.18') < 0;
  if (major === 2) return compareVersions(version, '2.1.4') < 0;
  if (major === 3) return compareVersions(version, '3.0.6') < 0;
  if (major === 4) return true;
  if (major === 5) return compareVersions(version, '5.0.9') < 0;

  return false;
}

async function readJson(filePath) {
  const content = await fs.readFile(filePath, 'utf8');
  return JSON.parse(content.replace(/^\uFEFF/u, ''));
}

async function writeJson(filePath, value) {
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function validateOverrides(packageJson) {
  const overrides = packageJson.overrides;
  if (!overrides || typeof overrides !== 'object' || Array.isArray(overrides)) {
    throw new Error('package.json nao possui um objeto overrides valido.');
  }

  const problems = [];
  for (const [selector, expectedVersion] of Object.entries(SAFE_OVERRIDES)) {
    if (overrides[selector] !== expectedVersion) {
      problems.push(`${selector} deveria apontar para ${expectedVersion}`);
    }
  }

  const staleKeys = Object.keys(overrides).filter(
    (key) =>
      (key === 'brace-expansion' || key.startsWith('brace-expansion@')) &&
      !Object.hasOwn(SAFE_OVERRIDES, key),
  );

  if (staleKeys.length > 0) {
    problems.push(`overrides antigos ou conflitantes: ${staleKeys.join(', ')}`);
  }

  if (problems.length > 0) {
    throw new Error(`Overrides invalidos: ${problems.join('; ')}`);
  }
}

function collectLockVersions(packageLock) {
  const found = [];
  const packages = packageLock.packages;

  if (packages && typeof packages === 'object') {
    for (const [lockPath, metadata] of Object.entries(packages)) {
      if (!isBraceExpansionLockPath(lockPath)) continue;
      found.push({
        location: lockPath || 'node_modules/brace-expansion',
        version: metadata?.version,
      });
    }
  }

  if (found.length === 0 && packageLock.dependencies?.['brace-expansion']) {
    found.push({
      location: 'dependencies.brace-expansion',
      version: packageLock.dependencies['brace-expansion'].version,
    });
  }

  return found;
}

function collectLockReferences(packageLock) {
  const references = [];
  const packages = packageLock.packages;

  if (packages && typeof packages === 'object') {
    for (const [lockPath, metadata] of Object.entries(packages)) {
      const requested = metadata?.dependencies?.['brace-expansion'];
      if (!requested) continue;
      references.push({
        location: lockPath || '<raiz>',
        requested,
      });
    }
  }

  return references;
}

function assertSafeVersions(found, sourceLabel) {
  if (found.length === 0) {
    throw new Error(
      `Nenhuma instalacao de brace-expansion foi encontrada em ${sourceLabel}; ` +
        'o lockfile ou node_modules esta incompleto.',
    );
  }

  const invalid = found.filter(({ version }) => !version || isVulnerable(version));
  if (invalid.length > 0) {
    const details = invalid
      .map(({ location, version }) => `${location}: ${version ?? 'sem versao'}`)
      .join(', ');
    throw new Error(`brace-expansion vulneravel encontrado em ${sourceLabel}: ${details}`);
  }

  const summary = found
    .map(({ location, version }) => `${location}=${version}`)
    .sort()
    .join(', ');
  console.log(`brace-expansion seguro em ${sourceLabel}: ${summary}`);
}

async function prepareManifest(root) {
  const packagePath = path.join(root, 'package.json');
  const packageJson = await readJson(packagePath);
  const currentOverrides =
    packageJson.overrides &&
    typeof packageJson.overrides === 'object' &&
    !Array.isArray(packageJson.overrides)
      ? packageJson.overrides
      : {};

  const nextOverrides = {};
  for (const [key, value] of Object.entries(currentOverrides)) {
    if (key === 'brace-expansion' || key.startsWith('brace-expansion@')) continue;
    nextOverrides[key] = value;
  }

  Object.assign(nextOverrides, SAFE_OVERRIDES);
  packageJson.overrides = nextOverrides;
  await writeJson(packagePath, packageJson);

  validateOverrides(packageJson);
  console.log(
    'package.json alinhado: linhas 1, 2, 3, 4 e 5 de brace-expansion apontam para versoes corrigidas.',
  );
}

async function verifyLock(root) {
  const packageJson = await readJson(path.join(root, 'package.json'));
  const packageLock = await readJson(path.join(root, 'package-lock.json'));

  validateOverrides(packageJson);

  if (!packageLock.packages || typeof packageLock.packages !== 'object') {
    throw new Error('package-lock.json nao possui a estrutura packages esperada do lockfile v2/v3.');
  }

  const references = collectLockReferences(packageLock);
  if (references.length === 0) {
    throw new Error(
      'Nenhuma dependencia do lockfile referencia brace-expansion; a resolucao foi gerada de forma incompleta.',
    );
  }

  assertSafeVersions(collectLockVersions(packageLock), 'package-lock.json');
  console.log(`Referencias internas validadas no lockfile: ${references.length}.`);
}

async function collectInstalledVersions(nodeModulesRoot) {
  const found = [];
  const visitedRealPaths = new Set();

  async function walk(directory, depth = 0) {
    if (depth > 80) {
      throw new Error(`Profundidade inesperada ao percorrer node_modules: ${directory}`);
    }

    let realDirectory;
    try {
      realDirectory = await fs.realpath(directory);
    } catch {
      return;
    }

    if (visitedRealPaths.has(realDirectory)) return;
    visitedRealPaths.add(realDirectory);

    let entries;
    try {
      entries = await fs.readdir(directory, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      if (!entry.isDirectory() && !entry.isSymbolicLink()) continue;
      if (entry.name === '.bin') continue;

      const entryPath = path.join(directory, entry.name);
      if (entry.name.startsWith('@')) {
        await walkScope(entryPath, depth + 1);
        continue;
      }

      await inspectPackage(entryPath, entry.name, depth + 1);
    }
  }

  async function walkScope(scopeDirectory, depth) {
    let entries;
    try {
      entries = await fs.readdir(scopeDirectory, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      if (!entry.isDirectory() && !entry.isSymbolicLink()) continue;
      await inspectPackage(path.join(scopeDirectory, entry.name), entry.name, depth + 1);
    }
  }

  async function inspectPackage(packageDirectory, packageName, depth) {
    if (packageName === 'brace-expansion') {
      const manifestPath = path.join(packageDirectory, 'package.json');
      const manifest = await readJson(manifestPath);
      found.push({
        location: normalizePath(path.relative(path.dirname(nodeModulesRoot), packageDirectory)),
        version: manifest.version,
      });
    }

    await walk(path.join(packageDirectory, 'node_modules'), depth + 1);
  }

  await walk(nodeModulesRoot);
  return found;
}

function countVersions(items) {
  const counts = new Map();
  for (const { version } of items) {
    const key = String(version);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}

function formatVersionCounts(counts) {
  return [...counts.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([version, count]) => `${version} x${count}`)
    .join(', ');
}

async function verifyInstalled(root) {
  const nodeModulesRoot = path.join(root, 'node_modules');
  const stats = await fs.stat(nodeModulesRoot).catch(() => null);
  if (!stats?.isDirectory()) {
    throw new Error(`node_modules nao encontrado em ${root}.`);
  }

  const packageLock = await readJson(path.join(root, 'package-lock.json'));
  const expected = collectLockVersions(packageLock);
  assertSafeVersions(expected, 'package-lock.json usado pela instalacao');

  const installed = await collectInstalledVersions(nodeModulesRoot);
  assertSafeVersions(installed, 'node_modules instalado');

  const expectedCounts = countVersions(expected);
  const installedCounts = countVersions(installed);
  const expectedSummary = formatVersionCounts(expectedCounts);
  const installedSummary = formatVersionCounts(installedCounts);

  if (expectedSummary !== installedSummary) {
    throw new Error(
      `node_modules nao reproduz todas as entradas do lockfile. Esperado: ${expectedSummary}. ` +
        `Instalado: ${installedSummary}.`,
    );
  }

  console.log(`node_modules reproduziu o lockfile: ${installedSummary}.`);
}

const mode = process.argv[2];
const root = path.resolve(getArgument('--root', process.cwd()));

try {
  if (mode === 'prepare-manifest') {
    await prepareManifest(root);
  } else if (mode === 'verify-lock') {
    await verifyLock(root);
  } else if (mode === 'verify-installed') {
    await verifyInstalled(root);
  } else {
    throw new Error('Modo invalido. Use prepare-manifest, verify-lock ou verify-installed.');
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
