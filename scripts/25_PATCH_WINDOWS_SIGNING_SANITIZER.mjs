import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const mode = process.argv[2] ?? "verify";
const rootArg = process.argv[3];

if (!rootArg || !["apply", "verify"].includes(mode)) {
  console.error(
    "Uso: node scripts/25_PATCH_WINDOWS_SIGNING_SANITIZER.mjs <apply|verify> <raiz-do-projeto>",
  );
  process.exit(2);
}

const root = path.resolve(rootArg);
const enginePath = path.join(root, "lib", "windows-signing-engine.ts");
const testPath = path.join(root, "tests", "unit", "windows-signing-engine.test.ts");
const scriptPath = path.join(root, "scripts", "windows-signing.mjs");

const sanitizerFunction = [
  "export function sanitizeWindowsSigningError(message: string): string {",
  "  return message",
  "    .replace(/[A-Fa-f0-9]{64,}/g, \"[SEGREDO_REMOVIDO]\")",
  "    .replace(/password\\s*[=:]\\s*[^\\s]+/gi, \"password=[SEGREDO_REMOVIDO]\")",
  "    .replace(/token\\s*[=:]\\s*[^\\s]+/gi, \"token=[SEGREDO_REMOVIDO]\")",
  "    .replace(/([\\\"'])[A-Za-z]:\\\\[^\\\"'\\r\\n]*\\1/g, \"[CAMINHO_REMOVIDO]\")",
  "    .replace(/\\b[A-Za-z]:\\\\[^\\s\\\"'<>|]+/g, \"[CAMINHO_REMOVIDO]\");",
  "}",
];

const sanitizerTest = [
  "  it(\"remove caminhos, tokens e segredos de erros\", () => {",
  "    const value = sanitizeWindowsSigningError(",
  "      `C:\\\\segredos\\\\cert.pfx password=abc token=xyz ${\"a\".repeat(64)}`,",
  "    );",
  "    expect(value).not.toContain(\"cert.pfx\");",
  "    expect(value).not.toContain(\"password=abc\");",
  "    expect(value).not.toContain(\"token=xyz\");",
  "    expect(value).toContain(\"[CAMINHO_REMOVIDO]\");",
  "    expect(value.match(/SEGREDO_REMOVIDO/g)).toHaveLength(3);",
  "  });",
  "",
  "  it(\"remove caminho Windows entre aspas sem engolir o restante do erro\", () => {",
  "    const value = sanitizeWindowsSigningError(",
  "      '\"C:\\\\Pasta de Release\\\\certificado final.pfx\" token=segredo detalhe preservado',",
  "    );",
  "    expect(value).toContain(\"[CAMINHO_REMOVIDO]\");",
  "    expect(value).toContain(\"token=[SEGREDO_REMOVIDO]\");",
  "    expect(value).toContain(\"detalhe preservado\");",
  "    expect(value).not.toContain(\"certificado final.pfx\");",
  "  });",
];

function withEol(lines, eol) {
  return lines.join(eol);
}

async function readText(filePath) {
  return fs.readFile(filePath, "utf8");
}

function verifyEngine(source) {
  const failures = [];
  const secretIndex = source.indexOf('.replace(/[A-Fa-f0-9]{64,}/g, "[SEGREDO_REMOVIDO]")');
  const pathIndex = source.indexOf('.replace(/\\b[A-Za-z]:\\\\[^\\s\\\"\'<>|]+/g, "[CAMINHO_REMOVIDO]")');

  if (secretIndex === -1) failures.push("substituicao de hashes longos ausente");
  if (pathIndex === -1) failures.push("regex delimitada para caminho Windows ausente");
  if (secretIndex !== -1 && pathIndex !== -1 && secretIndex > pathIndex) {
    failures.push("segredos ainda sao processados depois dos caminhos");
  }
  if (source.includes('/[A-Za-z]:\\\\[^\\r\\n\"\']+/g')) {
    failures.push("regex gulosa antiga de caminho Windows ainda permanece");
  }
  if (!source.includes('password=[SEGREDO_REMOVIDO]')) failures.push("marcador de senha ausente");
  if (!source.includes('token=[SEGREDO_REMOVIDO]')) failures.push("marcador de token ausente");

  if (failures.length > 0) {
    throw new Error(`Sanitizador de assinatura Windows incorreto:\n- ${failures.join("\n- ")}`);
  }
}

function verifyTest(source) {
  const failures = [];
  if (!source.includes("expect(value.match(/SEGREDO_REMOVIDO/g)).toHaveLength(3)")) {
    failures.push("teste nao exige os tres marcadores de segredo");
  }
  if (!source.includes("remove caminho Windows entre aspas sem engolir o restante do erro")) {
    failures.push("regressao de caminho com espacos nao esta coberta");
  }
  if (!source.includes('expect(value).toContain("detalhe preservado")')) {
    failures.push("teste nao confirma a preservacao do restante da mensagem");
  }
  if (failures.length > 0) {
    throw new Error(`Testes do sanitizador incompletos:\n- ${failures.join("\n- ")}`);
  }
}

function verifyScript(source) {
  if (/import\s*\{[^}]*\bwriteFile\b[^}]*\}\s*from\s*["']node:fs\/promises["'];?/u.test(source)) {
    throw new Error("scripts/windows-signing.mjs ainda importa writeFile sem uso.");
  }
}

async function verifyAll() {
  const [engine, test, script] = await Promise.all([
    readText(enginePath),
    readText(testPath),
    readText(scriptPath),
  ]);
  verifyEngine(engine);
  verifyTest(test);
  verifyScript(script);
  console.log("Sanitizador, testes de regressao e script Windows validados.");
}

if (mode === "verify") {
  await verifyAll();
  process.exit(0);
}

const [engineRaw, testRaw, scriptRaw] = await Promise.all([
  readText(enginePath),
  readText(testPath),
  readText(scriptPath),
]);
const engineEol = engineRaw.includes("\r\n") ? "\r\n" : "\n";
const testEol = testRaw.includes("\r\n") ? "\r\n" : "\n";

const enginePattern = /export function sanitizeWindowsSigningError\(message: string\): string \{[\s\S]*?\r?\n\}/u;
if (!enginePattern.test(engineRaw)) {
  throw new Error("Nao foi possivel localizar sanitizeWindowsSigningError no engine.");
}
const engineUpdated = engineRaw.replace(enginePattern, withEol(sanitizerFunction, engineEol));

const testPattern = /  it\("remove caminhos, tokens e segredos de erros", \(\) => \{[\s\S]*?\r?\n  \}\);/u;
if (!testPattern.test(testRaw)) {
  throw new Error("Nao foi possivel localizar o teste historico do sanitizador.");
}
let testUpdated = testRaw.replace(testPattern, withEol(sanitizerTest, testEol));

let scriptUpdated = scriptRaw.replace(
  /import \{ readFile, writeFile \} from "node:fs\/promises";/u,
  'import { readFile } from "node:fs/promises";',
);
scriptUpdated = scriptUpdated.replace(
  /import \{ writeFile, readFile \} from "node:fs\/promises";/u,
  'import { readFile } from "node:fs/promises";',
);

verifyEngine(engineUpdated);
verifyTest(testUpdated);
verifyScript(scriptUpdated);

await Promise.all([
  fs.writeFile(enginePath, engineUpdated, "utf8"),
  fs.writeFile(testPath, testUpdated, "utf8"),
  fs.writeFile(scriptPath, scriptUpdated, "utf8"),
]);

console.log(`Engine corrigido: ${enginePath}`);
console.log(`Testes ampliados: ${testPath}`);
console.log(`Import nao utilizado removido: ${scriptPath}`);
