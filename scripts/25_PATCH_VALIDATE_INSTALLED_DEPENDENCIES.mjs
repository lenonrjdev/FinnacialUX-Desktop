import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const mode = process.argv[2] ?? "verify";
const targetArg = process.argv[3];

if (!targetArg || !["apply", "verify"].includes(mode)) {
  console.error(
    "Uso: node scripts/25_PATCH_VALIDATE_INSTALLED_DEPENDENCIES.mjs <apply|verify> <scripts/validate-installed-dependencies.mjs>",
  );
  process.exit(2);
}

const targetPath = path.resolve(targetArg);
const raw = await fs.readFile(targetPath, "utf8");
const eol = raw.includes("\r\n") ? "\r\n" : "\n";

const helperMarker = "function isBraceExpansionVersionVulnerable(version)";
const patchedConditionMarker = "isBraceExpansionVersionVulnerable(entry.version)";
const legacyPredicate = 'lockKey.endsWith("node_modules/brace-expansion") && entry.version !== "5.0.8"';

const helperBlock = [
  "function parseBraceExpansionVersion(version) {",
  "  const match = String(version ?? \"\").trim().match(/^(\\d+)\\.(\\d+)\\.(\\d+)(?:[-+].*)?$/u);",
  "  if (!match) return null;",
  "  return match.slice(1).map(Number);",
  "}",
  "",
  "function compareBraceExpansionVersions(left, right) {",
  "  const a = parseBraceExpansionVersion(left);",
  "  const b = parseBraceExpansionVersion(right);",
  "  if (!a || !b) return null;",
  "  for (let index = 0; index < 3; index += 1) {",
  "    if (a[index] !== b[index]) return a[index] < b[index] ? -1 : 1;",
  "  }",
  "  return 0;",
  "}",
  "",
  "function isBraceExpansionVersionVulnerable(version) {",
  "  const parsed = parseBraceExpansionVersion(version);",
  "  if (!parsed) return true;",
  "  const [major] = parsed;",
  "  if (major < 1) return true;",
  "  if (major === 1) return compareBraceExpansionVersions(version, \"1.1.18\") < 0;",
  "  if (major === 2) return compareBraceExpansionVersions(version, \"2.1.4\") < 0;",
  "  if (major === 3) return compareBraceExpansionVersions(version, \"3.0.6\") < 0;",
  "  if (major === 4) return true;",
  "  if (major === 5) return compareBraceExpansionVersions(version, \"5.0.9\") < 0;",
  "  return false;",
  "}",
].join(eol);

function verifyPatched(source) {
  const failures = [];
  if (!source.includes(helperMarker)) {
    failures.push("comparador seguro de brace-expansion ausente");
  }
  if (!source.includes(patchedConditionMarker)) {
    failures.push("a varredura do lockfile ainda nao usa o comparador seguro");
  }
  if (source.includes(legacyPredicate)) {
    failures.push("a comparacao legada que rejeita 5.0.9 ainda permanece");
  }

  const requiredThresholds = ["1.1.18", "2.1.4", "3.0.6", "5.0.9"];
  for (const threshold of requiredThresholds) {
    if (!source.includes(`\"${threshold}\"`)) {
      failures.push(`limite seguro ${threshold} ausente`);
    }
  }

  if (failures.length > 0) {
    throw new Error(`Validador acumulado ainda incorreto:\n- ${failures.join("\n- ")}`);
  }
}

if (mode === "verify") {
  verifyPatched(raw);
  console.log("Validador acumulado aceita as versoes corrigidas de brace-expansion.");
  process.exit(0);
}

let updated = raw;

if (!updated.includes(helperMarker)) {
  const insertionMarker = "for (const [lockKey, entry] of Object.entries(lock.packages ?? {})) {";
  const insertionIndex = updated.indexOf(insertionMarker);
  if (insertionIndex === -1) {
    throw new Error("Nao foi possivel localizar a varredura transitiva do lockfile.");
  }
  updated = `${updated.slice(0, insertionIndex)}${helperBlock}${eol}${eol}${updated.slice(insertionIndex)}`;
}

if (updated.includes(legacyPredicate)) {
  updated = updated.replace(
    `if (${legacyPredicate}) {${eol}    failures.push(\`brace-expansion vulnerável ou inesperado em \${lockKey}: \${entry.version ?? "sem versão"}\`);${eol}  }`,
    [
      'if (lockKey.endsWith("node_modules/brace-expansion") &&',
      "      isBraceExpansionVersionVulnerable(entry.version)) {",
      "    failures.push(",
      "      `brace-expansion vulneravel ou inesperado em ${lockKey}: ${entry.version ?? \"sem versao\"}` ,",
      "    );",
      "  }",
    ].join(eol),
  );
}

updated = updated.replace(
  "Camada minimatch direta instalada e nenhum brace-expansion anterior a 5.0.8 permaneceu.",
  "Camada minimatch direta instalada e nenhuma linha vulneravel de brace-expansion permaneceu.",
);

verifyPatched(updated);

if (updated !== raw) {
  await fs.writeFile(targetPath, updated, "utf8");
  console.log(`Validador corrigido: ${targetPath}`);
} else {
  console.log(`Validador ja estava corrigido: ${targetPath}`);
}
