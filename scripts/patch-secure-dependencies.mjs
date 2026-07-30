import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const target = process.argv[2];

if (!target) {
  console.error("Uso: node scripts/patch-secure-dependencies.mjs <package.json>");
  process.exit(1);
}

const packagePath = resolve(target);
const raw = await readFile(packagePath, "utf8");
const pkg = JSON.parse(raw);

pkg.version = "0.8.6";
pkg.description =
  "FinnacialUX Desktop — gestão financeira pessoal offline com SQLCipher, portabilidade protegida, regressão automatizada e dependências auditadas.";

pkg.dependencies ??= {};
pkg.devDependencies ??= {};
pkg.engines ??= {};

// Remove resíduos das tentativas anteriores.
delete pkg.dependencies.postcss;
delete pkg.dependencies.sharp;
delete pkg.devDependencies.postcss;
delete pkg.devDependencies.sharp;
delete pkg.dependencies.minimatch;
delete pkg.dependencies["minimatch-secure"];
delete pkg.devDependencies["minimatch-secure"];
delete pkg.dependencies[pkg.name];
delete pkg.devDependencies[pkg.name];

pkg.dependencies.next = "16.2.12";
pkg.devDependencies.eslint = "9.39.4";
pkg.devDependencies["eslint-config-next"] = "16.2.12";
pkg.devDependencies.vitest = "4.1.10";
pkg.devDependencies["@vitest/coverage-v8"] = "4.1.10";
pkg.devDependencies["@playwright/test"] = "1.61.1";

// Instala a camada compatível também no topo da árvore. Isso torna o smoke
// test independente do local onde o npm posiciona as cópias transitivas.
pkg.devDependencies.minimatch = "file:vendor/minimatch-v3-secure-compat";

pkg.engines.node = ">=22.13.0";
pkg.engines.npm = ">=10.9.0";

pkg.overrides = {
  postcss: "8.5.23",
  sharp: "0.35.3",
  "minimatch@3.1.5": "file:vendor/minimatch-v3-secure-compat"
};

await writeFile(packagePath, `${JSON.stringify(pkg, null, 2)}\n`, "utf8");
console.log(`Manifesto seguro preparado: ${packagePath}`);
