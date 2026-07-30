import { access, readFile } from "node:fs/promises";
import { constants } from "node:fs";
import { join, resolve } from "node:path";

const projectDir = resolve(process.argv[2] ?? ".");
const packagePath = join(projectDir, "package.json");
const lockPath = join(projectDir, "package-lock.json");
const nodeModulesPath = join(projectDir, "node_modules");

function packageDirectory(base, name) {
  return join(base, ...name.split("/"));
}

async function readJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

async function assertExists(path, message) {
  try {
    await access(path, constants.R_OK);
  } catch {
    throw new Error(message);
  }
}

function assertEqual(actual, expected, label) {
  if (actual !== expected) {
    throw new Error(`${label}: esperado ${expected}, encontrado ${String(actual)}`);
  }
}

function versionParts(value) {
  const match = String(value).match(/^(\d+)\.(\d+)\.(\d+)/);
  if (!match) throw new Error(`Versão inválida: ${String(value)}`);
  return match.slice(1).map(Number);
}

function assertMinimumVersion(actual, minimum, label) {
  const current = versionParts(actual);
  const required = versionParts(minimum);
  for (let index = 0; index < required.length; index += 1) {
    if (current[index] > required[index]) return;
    if (current[index] < required[index]) {
      throw new Error(`${label}: esperado ${minimum} ou superior, encontrado ${actual}`);
    }
  }
}

const pkg = await readJson(packagePath);
const lock = await readJson(lockPath);
const lockRoot = lock.packages?.[""];

if (!lockRoot) {
  throw new Error('O package-lock.json não possui a entrada raiz packages[""].');
}

assertMinimumVersion(pkg.version, "0.8.6", "Versão do package.json");
assertEqual(lockRoot.name, pkg.name, "Nome raiz do lockfile");
assertEqual(lockRoot.version, pkg.version, "Versão raiz do lockfile");
assertEqual(pkg.dependencies?.next, "16.2.12", "Next.js");
assertEqual(pkg.devDependencies?.eslint, "9.39.4", "ESLint");
assertEqual(pkg.devDependencies?.["eslint-config-next"], "16.2.12", "eslint-config-next");
assertEqual(pkg.devDependencies?.vitest, "4.1.10", "Vitest");
assertEqual(pkg.devDependencies?.["@vitest/coverage-v8"], "4.1.10", "Cobertura V8");
assertEqual(
  pkg.devDependencies?.minimatch,
  "file:vendor/minimatch-v3-secure-compat",
  "Camada minimatch direta",
);
assertEqual(pkg.overrides?.postcss, "8.5.23", "Override do PostCSS");
assertEqual(pkg.overrides?.sharp, "0.35.3", "Override do Sharp");
assertEqual(
  pkg.overrides?.["minimatch@3.1.5"],
  "file:vendor/minimatch-v3-secure-compat",
  "Override compatível do minimatch legado",
);

if (pkg.dependencies?.[pkg.name] || pkg.devDependencies?.[pkg.name]) {
  throw new Error("O projeto não pode depender de si mesmo.");
}

const selfLockEntry = lock.packages?.[`node_modules/${pkg.name}`];
if (selfLockEntry?.link) {
  throw new Error("O lockfile contém um vínculo indevido para o próprio projeto.");
}

await assertExists(nodeModulesPath, "node_modules não foi criado.");

const directDependencies = {
  ...(pkg.dependencies ?? {}),
  ...(pkg.devDependencies ?? {})
};

const failures = [];
for (const name of Object.keys(directDependencies).sort()) {
  const installedManifestPath = join(packageDirectory(nodeModulesPath, name), "package.json");
  const lockKey = `node_modules/${name}`;
  const lockEntry = lock.packages?.[lockKey];

  try {
    await assertExists(installedManifestPath, `Dependência direta ausente: ${name}`);
    if (!lockEntry) {
      throw new Error(`Dependência direta ausente no lockfile: ${name}`);
    }

    const installed = await readJson(installedManifestPath);
    if (lockEntry.version && installed.version !== lockEntry.version) {
      throw new Error(`${name}: instalado ${installed.version}, lockfile ${lockEntry.version}`);
    }
  } catch (error) {
    failures.push(error instanceof Error ? error.message : String(error));
  }
}

const installedMinimatch = await readJson(
  join(nodeModulesPath, "minimatch", "package.json"),
);
if (installedMinimatch.version !== "10.2.6") {
  failures.push(
    `A camada minimatch direta deveria estar na versão 10.2.6, encontrada ${installedMinimatch.version}.`,
  );
}

for (const [lockKey, entry] of Object.entries(lock.packages ?? {})) {
  if (!entry || typeof entry !== "object") continue;

  if (lockKey.endsWith("node_modules/brace-expansion") && entry.version !== "5.0.8") {
    failures.push(`brace-expansion vulnerável ou inesperado em ${lockKey}: ${entry.version ?? "sem versão"}`);
  }

  if (lockKey.endsWith("node_modules/minimatch") && entry.version === "3.1.5") {
    failures.push(`minimatch 3.1.5 permaneceu no lockfile: ${lockKey}`);
  }
}

if (failures.length > 0) {
  throw new Error(`Árvore direta ou transitiva inconsistente:\n- ${failures.join("\n- ")}`);
}

console.log(`Árvore direta validada: ${Object.keys(directDependencies).length} dependências.`);
console.log(`Manifesto e lockfile alinhados na versão ${pkg.version}.`);
console.log("Camada minimatch direta instalada e nenhum brace-expansion anterior a 5.0.8 permaneceu.");
