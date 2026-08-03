import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { createRequire } from 'node:module';

const EXPECTED_PROJECT_VERSION = '1.5.0';
const LOCAL_MINIMATCH_SPEC = 'file:vendor/minimatch-v3-secure-compat';
const LOCAL_MINIMATCH_RELATIVE = 'vendor/minimatch-v3-secure-compat';
const MINIMATCH_VERSION = '10.2.6';
const MINIMATCH_ALIAS_SPEC = 'npm:minimatch@10.2.6';

const SAFE_OVERRIDES = Object.freeze({
  'brace-expansion@1': '1.1.18',
  'brace-expansion@2': '2.1.4',
  'brace-expansion@3': '3.0.6',
  'brace-expansion@4': '5.0.9',
  'brace-expansion@5': '5.0.9',
});

function getArgument(name, fallback = undefined) {
  const index = process.argv.indexOf(name);
  if (index === -1 || index + 1 >= process.argv.length) return fallback;
  return process.argv[index + 1];
}

function normalizePath(value) {
  return String(value).replaceAll('\\', '/').replace(/^\.\//u, '');
}

function parseVersion(version) {
  const match = String(version).trim().match(/^(\d+)\.(\d+)\.(\d+)(?:[-+].*)?$/u);
  if (!match) throw new Error(`Versao semver invalida: ${version}`);
  return match.slice(1).map(Number);
}

function compareVersions(left, right) {
  const a = parseVersion(left);
  const b = parseVersion(right);
  for (let index = 0; index < 3; index += 1) {
    if (a[index] !== b[index]) return a[index] < b[index] ? -1 : 1;
  }
  return 0;
}

function isVulnerableBraceExpansion(version) {
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
  const raw = await fs.readFile(filePath, 'utf8');
  return JSON.parse(raw.replace(/^\uFEFF/u, ''));
}

async function pathExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

function assertEqual(actual, expected, label) {
  if (actual !== expected) {
    throw new Error(`${label}: esperado ${JSON.stringify(expected)}, encontrado ${JSON.stringify(actual)}.`);
  }
}

function validateOverrides(packageJson) {
  const overrides = packageJson.overrides;
  if (!overrides || typeof overrides !== 'object' || Array.isArray(overrides)) {
    throw new Error('package.json nao possui um objeto overrides valido.');
  }

  const failures = [];
  for (const [selector, expected] of Object.entries(SAFE_OVERRIDES)) {
    if (overrides[selector] !== expected) {
      failures.push(`${selector} deveria apontar para ${expected}`);
    }
  }

  const stale = Object.keys(overrides).filter(
    (key) =>
      (key === 'brace-expansion' || key.startsWith('brace-expansion@')) &&
      !Object.hasOwn(SAFE_OVERRIDES, key),
  );
  if (stale.length > 0) failures.push(`overrides antigos ou conflitantes: ${stale.join(', ')}`);

  if (failures.length > 0) throw new Error(`Overrides invalidos: ${failures.join('; ')}`);
}

async function validateManifest(root) {
  const packageJson = await readJson(path.join(root, 'package.json'));
  assertEqual(packageJson.version, EXPECTED_PROJECT_VERSION, 'Versao do projeto');
  assertEqual(
    packageJson.devDependencies?.minimatch,
    LOCAL_MINIMATCH_SPEC,
    'Dependencia local minimatch',
  );
  validateOverrides(packageJson);

  const vendorManifestPath = path.join(root, LOCAL_MINIMATCH_RELATIVE, 'package.json');
  if (!(await pathExists(vendorManifestPath))) {
    throw new Error(`Pacote local ausente: ${vendorManifestPath}`);
  }

  const vendorManifest = await readJson(vendorManifestPath);
  assertEqual(vendorManifest.name, 'minimatch', 'Nome do pacote local minimatch');
  assertEqual(vendorManifest.version, MINIMATCH_VERSION, 'Versao do pacote local minimatch');
  assertEqual(
    vendorManifest.dependencies?.['minimatch-secure'],
    MINIMATCH_ALIAS_SPEC,
    'Alias interno minimatch-secure',
  );

  console.log('Manifesto principal e pacote vendor minimatch validados.');
  return { packageJson, vendorManifest };
}

function isBraceExpansionLockPath(lockPath) {
  return /(^|\/)node_modules\/brace-expansion$/u.test(normalizePath(lockPath));
}

function isMinimatchSecureLockPath(lockPath) {
  return /(^|\/)node_modules\/minimatch-secure$/u.test(normalizePath(lockPath));
}

function collectBraceLockVersions(packageLock) {
  const found = [];
  for (const [lockPath, metadata] of Object.entries(packageLock.packages ?? {})) {
    if (!isBraceExpansionLockPath(lockPath)) continue;
    found.push({ location: normalizePath(lockPath), version: metadata?.version });
  }
  return found;
}

function collectBraceReferences(packageLock) {
  const found = [];
  for (const [lockPath, metadata] of Object.entries(packageLock.packages ?? {})) {
    const requested = metadata?.dependencies?.['brace-expansion'];
    if (!requested) continue;
    found.push({ location: normalizePath(lockPath || '<raiz>'), requested });
  }
  return found;
}

function collectAliasLockEntries(packageLock) {
  const found = [];
  for (const [lockPath, metadata] of Object.entries(packageLock.packages ?? {})) {
    if (!isMinimatchSecureLockPath(lockPath)) continue;
    found.push({ location: normalizePath(lockPath), version: metadata?.version, name: metadata?.name });
  }
  return found;
}

function collectAliasReferences(packageLock) {
  const found = [];
  for (const [lockPath, metadata] of Object.entries(packageLock.packages ?? {})) {
    const requested = metadata?.dependencies?.['minimatch-secure'];
    if (!requested) continue;
    found.push({ location: normalizePath(lockPath || '<raiz>'), requested });
  }
  return found;
}

function assertSafeBraceVersions(found, sourceLabel) {
  if (found.length === 0) {
    throw new Error(`Nenhuma instalacao de brace-expansion encontrada em ${sourceLabel}.`);
  }

  const invalid = found.filter(({ version }) => !version || isVulnerableBraceExpansion(version));
  if (invalid.length > 0) {
    throw new Error(
      `brace-expansion vulneravel em ${sourceLabel}: ${invalid
        .map(({ location, version }) => `${location}=${version ?? 'sem versao'}`)
        .join(', ')}`,
    );
  }

  console.log(
    `brace-expansion seguro em ${sourceLabel}: ${found
      .map(({ location, version }) => `${location}=${version}`)
      .sort()
      .join(', ')}`,
  );
}

async function verifyLock(root) {
  const { packageJson } = await validateManifest(root);
  const packageLock = await readJson(path.join(root, 'package-lock.json'));
  const packages = packageLock.packages;
  if (!packages || typeof packages !== 'object') {
    throw new Error('package-lock.json nao possui a estrutura packages esperada.');
  }

  const lockRoot = packages[''];
  if (!lockRoot) throw new Error('package-lock.json nao possui packages[""].');
  assertEqual(lockRoot.name, packageJson.name, 'Nome raiz do lockfile');
  assertEqual(lockRoot.version, packageJson.version, 'Versao raiz do lockfile');
  assertEqual(
    lockRoot.devDependencies?.minimatch,
    LOCAL_MINIMATCH_SPEC,
    'Dependencia minimatch na raiz do lockfile',
  );

  const vendorEntry = Object.entries(packages).find(([lockPath, metadata]) => {
    const normalized = normalizePath(lockPath);
    return (
      normalized === LOCAL_MINIMATCH_RELATIVE ||
      (metadata?.name === 'minimatch' &&
        metadata?.version === MINIMATCH_VERSION &&
        metadata?.dependencies?.['minimatch-secure'] === MINIMATCH_ALIAS_SPEC)
    );
  });
  if (!vendorEntry) {
    throw new Error('O package-lock nao registrou o manifesto do pacote local minimatch.');
  }

  const directLink = packages['node_modules/minimatch'];
  if (!directLink) throw new Error('O package-lock nao possui node_modules/minimatch.');

  const aliasReferences = collectAliasReferences(packageLock);
  if (!aliasReferences.some(({ requested }) => requested === MINIMATCH_ALIAS_SPEC)) {
    throw new Error('O package-lock nao registrou a referencia npm:minimatch@10.2.6 do pacote local.');
  }

  const aliasEntries = collectAliasLockEntries(packageLock);
  if (aliasEntries.length === 0) {
    throw new Error('O package-lock nao possui a entrada instalada minimatch-secure.');
  }
  const invalidAliases = aliasEntries.filter(({ version }) => version !== MINIMATCH_VERSION);
  if (invalidAliases.length > 0) {
    throw new Error(
      `minimatch-secure inesperado no lockfile: ${invalidAliases
        .map(({ location, version }) => `${location}=${version ?? 'sem versao'}`)
        .join(', ')}`,
    );
  }

  const braceReferences = collectBraceReferences(packageLock);
  if (braceReferences.length === 0) {
    throw new Error('Nenhuma dependencia do lockfile referencia brace-expansion.');
  }
  assertSafeBraceVersions(collectBraceLockVersions(packageLock), 'package-lock.json');

  console.log(
    `Alias minimatch-secure registrado no lockfile: ${aliasEntries
      .map(({ location, version }) => `${location}=${version}`)
      .join(', ')}.`,
  );
  console.log(`Referencias de brace-expansion no lockfile: ${braceReferences.length}.`);
}

async function collectInstalledPackages(nodeModulesRoot, targetName) {
  const found = [];
  const visited = new Set();

  async function walk(directory, depth = 0) {
    if (depth > 80) throw new Error(`Profundidade inesperada em node_modules: ${directory}`);
    let real;
    try {
      real = await fs.realpath(directory);
    } catch {
      return;
    }
    if (visited.has(real)) return;
    visited.add(real);

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
        let scoped;
        try {
          scoped = await fs.readdir(entryPath, { withFileTypes: true });
        } catch {
          continue;
        }
        for (const child of scoped) {
          if (!child.isDirectory() && !child.isSymbolicLink()) continue;
          await inspectPackage(path.join(entryPath, child.name), child.name, depth + 1);
        }
      } else {
        await inspectPackage(entryPath, entry.name, depth + 1);
      }
    }
  }

  async function inspectPackage(packageDirectory, packageName, depth) {
    if (packageName === targetName) {
      const manifest = await readJson(path.join(packageDirectory, 'package.json'));
      found.push({
        location: normalizePath(path.relative(path.dirname(nodeModulesRoot), packageDirectory)),
        version: manifest.version,
        name: manifest.name,
      });
    }
    await walk(path.join(packageDirectory, 'node_modules'), depth + 1);
  }

  await walk(nodeModulesRoot);
  return found;
}

function versionCounts(items) {
  const counts = new Map();
  for (const { version } of items) counts.set(version, (counts.get(version) ?? 0) + 1);
  return [...counts.entries()]
    .sort(([a], [b]) => String(a).localeCompare(String(b)))
    .map(([version, count]) => `${version} x${count}`)
    .join(', ');
}

async function verifyInstalled(root) {
  await verifyLock(root);
  const nodeModulesRoot = path.join(root, 'node_modules');
  if (!(await pathExists(nodeModulesRoot))) throw new Error('node_modules nao encontrado.');

  const wrapperManifest = await readJson(path.join(nodeModulesRoot, 'minimatch', 'package.json'));
  assertEqual(wrapperManifest.name, 'minimatch', 'Nome do minimatch instalado');
  assertEqual(wrapperManifest.version, MINIMATCH_VERSION, 'Versao do minimatch instalado');
  assertEqual(
    wrapperManifest.dependencies?.['minimatch-secure'],
    MINIMATCH_ALIAS_SPEC,
    'Alias interno do minimatch instalado',
  );

  const requireFromWrapper = createRequire(path.join(nodeModulesRoot, 'minimatch', 'package.json'));
  const aliasManifestPath = requireFromWrapper.resolve('minimatch-secure/package.json');
  const aliasManifest = await readJson(aliasManifestPath);
  assertEqual(aliasManifest.name, 'minimatch', 'Nome real do alias minimatch-secure');
  assertEqual(aliasManifest.version, MINIMATCH_VERSION, 'Versao instalada do alias minimatch-secure');

  const packageLock = await readJson(path.join(root, 'package-lock.json'));
  const expectedBrace = collectBraceLockVersions(packageLock);
  const installedBrace = await collectInstalledPackages(nodeModulesRoot, 'brace-expansion');
  assertSafeBraceVersions(installedBrace, 'node_modules');

  const expectedSummary = versionCounts(expectedBrace);
  const installedSummary = versionCounts(installedBrace);
  if (expectedSummary !== installedSummary) {
    throw new Error(
      `node_modules nao reproduziu brace-expansion do lockfile. Esperado: ${expectedSummary}; instalado: ${installedSummary}.`,
    );
  }

  const installedAliases = await collectInstalledPackages(nodeModulesRoot, 'minimatch-secure');
  if (installedAliases.length === 0) {
    throw new Error('A pasta minimatch-secure nao foi encontrada em node_modules.');
  }
  if (installedAliases.some(({ version }) => version !== MINIMATCH_VERSION)) {
    throw new Error(`Versao inesperada de minimatch-secure instalada: ${versionCounts(installedAliases)}.`);
  }

  console.log(`minimatch-secure resolvido em: ${normalizePath(aliasManifestPath)}.`);
  console.log(`node_modules reproduziu brace-expansion do lockfile: ${installedSummary}.`);
}

const mode = process.argv[2];
const root = path.resolve(getArgument('--root', process.cwd()));

try {
  if (mode === 'verify-manifest') {
    await validateManifest(root);
  } else if (mode === 'verify-lock') {
    await verifyLock(root);
  } else if (mode === 'verify-installed') {
    await verifyInstalled(root);
  } else {
    throw new Error('Modo invalido. Use verify-manifest, verify-lock ou verify-installed.');
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
