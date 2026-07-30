import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { readFile } from "node:fs/promises";

const projectDir = resolve(process.argv[2] ?? ".");
const requireFromProject = createRequire(join(projectDir, "package.json"));

// A camada é agora uma dependência direta, logo esta resolução é estável.
const legacyManifestPath = requireFromProject.resolve("minimatch/package.json");
const requireFromLegacy = createRequire(legacyManifestPath);
const legacy = requireFromProject("minimatch");

// A implementação moderna é resolvida a partir da própria camada instalada.
// Isso funciona tanto quando o npm faz hoisting quanto quando mantém a
// dependência aninhada dentro do pacote local.
const modern = requireFromLegacy("minimatch-secure");
const modernManifestPath = requireFromLegacy.resolve("minimatch-secure/package.json");
const legacyManifest = JSON.parse(await readFile(legacyManifestPath, "utf8"));
const modernManifest = JSON.parse(await readFile(modernManifestPath, "utf8"));

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

assert(typeof legacy === "function", "A API legada deve exportar uma função CommonJS.");
assert(typeof modern.minimatch === "function", "O minimatch seguro não expôs minimatch().");
assert(legacy("src/index.ts", "**/*.ts") === true, "A correspondência glob básica falhou.");
assert(legacy("src/index.ts", "**/*.js") === false, "A rejeição glob básica falhou.");
assert(typeof legacy.Minimatch === "function", "A classe Minimatch não foi preservada.");
assert(typeof legacy.filter === "function", "A função filter() não foi preservada.");
assert(typeof legacy.match === "function", "A função match() não foi preservada.");
assert(typeof legacy.braceExpand === "function", "A função braceExpand() não foi preservada.");
assert(
  JSON.stringify(legacy.braceExpand("arquivo-{a,b}.txt")) ===
    JSON.stringify(["arquivo-a.txt", "arquivo-b.txt"]),
  "A expansão de chaves compatível falhou.",
);
assert(legacyManifest.name === "minimatch", `Nome da camada inesperado: ${legacyManifest.name}`);
assert(legacyManifest.version === "10.2.6", `Wrapper minimatch inesperado: ${legacyManifest.version}`);
assert(modernManifest.version === "10.2.6", `minimatch seguro inesperado: ${modernManifest.version}`);
assert(
  dirname(modernManifestPath).toLowerCase().includes("minimatch-secure"),
  `A implementação moderna foi resolvida de um local inesperado: ${modernManifestPath}`,
);

console.log("Compatibilidade minimatch v3 validada sobre minimatch 10.2.6.");
console.log(`Camada: ${legacyManifestPath}`);
console.log(`Implementação segura: ${modernManifestPath}`);
