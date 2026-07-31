import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { access, mkdir, readFile, readdir, stat, writeFile, copyFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const EXPECTED_VERSION = "0.18.0-rc.1";
const EXPECTED_SCHEMA = 14;

function sha256File(filePath) {
  return new Promise((resolve, reject) => {
    const hash = createHash("sha256");
    const stream = createReadStream(filePath);
    stream.on("error", reject);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("end", () => resolve(hash.digest("hex")));
  });
}

async function exists(filePath) {
  try { await access(filePath); return true; } catch { return false; }
}

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

function cargoVersion(text) {
  return text.match(/^\[package\][\s\S]*?^version\s*=\s*"([^"]+)"/m)?.[1] ?? "";
}

function cargoDependencies(text) {
  const section = text.match(/^\[dependencies\]\s*([\s\S]*?)(?=^\[|\s*$)/m)?.[1] ?? "";
  return section.split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#") && line.includes("="))
    .map((line) => {
      const [name, ...valueParts] = line.split("=");
      return { name: name.trim(), declaration: valueParts.join("=").trim() };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

async function verifySource(root) {
  const config = await readJson(path.join(root, "release", "release-candidate.json"));
  const freeze = await readJson(path.join(root, "release", "schema-freeze-14.json"));
  const pkg = await readJson(path.join(root, "package.json"));
  const tauri = await readJson(path.join(root, "src-tauri", "tauri.conf.json"));
  const cargoText = await readFile(path.join(root, "src-tauri", "Cargo.toml"), "utf8");
  const versions = [String(pkg.version), String(tauri.version), cargoVersion(cargoText)];
  if (versions.some((version) => version !== EXPECTED_VERSION)) {
    throw new Error(`Versões divergentes: ${versions.join(", ")}`);
  }
  if (config.version !== EXPECTED_VERSION || config.schemaVersion !== EXPECTED_SCHEMA || !config.schemaFrozen) {
    throw new Error("Configuração da versão candidata inválida.");
  }
  const migrationsDirectory = path.join(root, "src-tauri", "migrations");
  const actualFiles = (await readdir(migrationsDirectory)).filter((name) => /^\d{4}_.+\.sql$/.test(name)).sort();
  if (actualFiles.length !== freeze.migrationCount || actualFiles.at(-1)?.slice(0, 4) !== "0014") {
    throw new Error(`O schema não está congelado: ${actualFiles.length} migrations, última ${actualFiles.at(-1) ?? "ausente"}.`);
  }
  for (const migration of freeze.migrations) {
    const filePath = path.join(migrationsDirectory, migration.file);
    const hash = await sha256File(filePath);
    if (hash !== migration.sha256) throw new Error(`Migration alterada após congelamento: ${migration.file}`);
  }
  for (const source of ["encrypted_database.rs", "protection.rs", "diagnostics.rs"]) {
    const text = await readFile(path.join(root, "src-tauri", "src", source), "utf8");
    if (!text.includes(`CURRENT_SCHEMA_VERSION: i64 = ${EXPECTED_SCHEMA}`)) {
      throw new Error(`${source} não reconhece o schema ${EXPECTED_SCHEMA}.`);
    }
  }
  if (await exists(path.join(root, "src-tauri", "migrations", "0015_release_candidate.sql"))) {
    throw new Error("A Release Candidate não pode criar a migration 0015.");
  }
  return { config, freeze, pkg, tauri, cargoText };
}

async function createInventory(root, source) {
  const dependencies = Object.entries(source.pkg.dependencies ?? {}).map(([name, declaration]) => ({ name, declaration, scope: "runtime" }));
  const development = Object.entries(source.pkg.devDependencies ?? {}).map(([name, declaration]) => ({ name, declaration, scope: "development" }));
  return {
    formatVersion: 1,
    product: source.config.product,
    version: source.config.version,
    generatedAt: new Date().toISOString(),
    npm: [...dependencies, ...development].sort((a, b) => a.name.localeCompare(b.name)),
    cargo: cargoDependencies(source.cargoText),
    note: "Inventário declarativo. As licenças completas permanecem nos pacotes originais e nos respectivos repositórios.",
  };
}

async function prepareSourceManifest(root) {
  const source = await verifySource(root);
  const output = path.join(root, "releases", EXPECTED_VERSION);
  await mkdir(output, { recursive: true });
  const criticalFiles = [
    "package.json",
    "package-lock.json",
    "src-tauri/Cargo.toml",
    "src-tauri/Cargo.lock",
    "src-tauri/tauri.conf.json",
    "release/schema-freeze-14.json",
    "release/release-candidate.json",
  ];
  const hashes = [];
  for (const relative of criticalFiles) {
    const filePath = path.join(root, relative);
    if (!(await exists(filePath))) continue;
    hashes.push({ file: relative.replaceAll("\\", "/"), sha256: await sha256File(filePath) });
  }
  for (const migration of source.freeze.migrations) {
    hashes.push({ file: `src-tauri/migrations/${migration.file}`, sha256: migration.sha256 });
  }
  const buildManifest = {
    formatVersion: 1,
    product: source.config.product,
    version: EXPECTED_VERSION,
    channel: "release-candidate",
    schemaVersion: EXPECTED_SCHEMA,
    schemaFrozen: true,
    tag: source.config.tag,
    target: source.config.target,
    generatedAt: new Date().toISOString(),
    sourceHashes: hashes,
  };
  await writeFile(path.join(output, "RC_BUILD_MANIFEST.json"), `${JSON.stringify(buildManifest, null, 2)}\n`, "utf8");
  await writeFile(path.join(output, "DEPENDENCY_INVENTORY.json"), `${JSON.stringify(await createInventory(root, source), null, 2)}\n`, "utf8");
  await copyFile(path.join(root, "release", "RC_CHECKLIST_0_18_0_RC_1.md"), path.join(output, "RC_CHECKLIST.md"));
  await copyFile(path.join(root, "PRIVACY.md"), path.join(output, "PRIVACY.md"));
  await copyFile(path.join(root, "SECURITY.md"), path.join(output, "SECURITY.md"));
  return output;
}

async function verifyArtifacts(root, releaseDirectory) {
  const source = await verifySource(root);
  const directory = path.resolve(root, releaseDirectory ?? path.join("releases", EXPECTED_VERSION));
  const installerName = `FinnacialUX-Desktop_${EXPECTED_VERSION}_x64-setup.exe`;
  const required = [installerName, `${installerName}.sig`, "latest.json", "SHA256SUMS.txt", "release-manifest.json", "RELEASE_NOTES.md", "RC_BUILD_MANIFEST.json", "DEPENDENCY_INVENTORY.json"];
  for (const name of required) {
    const filePath = path.join(directory, name);
    const info = await stat(filePath).catch(() => null);
    if (!info?.isFile() || info.size <= 0) throw new Error(`Artefato obrigatório ausente ou vazio: ${name}`);
  }
  const installerHash = await sha256File(path.join(directory, installerName));
  const sums = await readFile(path.join(directory, "SHA256SUMS.txt"), "utf8");
  if (!sums.includes(`${installerHash}  ${installerName}`)) throw new Error("SHA256SUMS.txt não corresponde ao instalador.");
  const manifest = await readJson(path.join(directory, "release-manifest.json"));
  if (manifest.version !== EXPECTED_VERSION || manifest.sha256 !== installerHash || manifest.prerelease !== true || manifest.channel !== "release-candidate") {
    throw new Error("Manifesto final não identifica corretamente a Release Candidate.");
  }
  const latest = await readJson(path.join(directory, "latest.json"));
  if (latest.version !== EXPECTED_VERSION || !latest.platforms?.["windows-x86_64"]?.signature) {
    throw new Error("latest.json inválido para o updater Tauri.");
  }
  const validation = {
    formatVersion: 1,
    product: source.config.product,
    version: EXPECTED_VERSION,
    schemaVersion: EXPECTED_SCHEMA,
    validatedAt: new Date().toISOString(),
    installer: installerName,
    installerSha256: installerHash,
    updaterSignaturePresent: true,
    sourceManifestPresent: true,
    manualMatrixComplete: false,
    status: "automatic-checks-passed",
  };
  await writeFile(path.join(directory, "RC_VALIDATION_REPORT.json"), `${JSON.stringify(validation, null, 2)}\n`, "utf8");
  return directory;
}

async function main() {
  const [command = "verify-source", rootArg = ".", releaseDirectory] = process.argv.slice(2);
  const root = path.resolve(rootArg);
  if (command === "verify-source") {
    await verifySource(root);
    console.log(`Release Candidate ${EXPECTED_VERSION}: fonte validada, schema ${EXPECTED_SCHEMA} congelado.`);
    return;
  }
  if (command === "prepare") {
    const output = await prepareSourceManifest(root);
    console.log(`Manifestos da Release Candidate preparados em: ${output}`);
    return;
  }
  if (command === "verify-artifacts") {
    const output = await verifyArtifacts(root, releaseDirectory);
    console.log(`Artefatos da Release Candidate validados em: ${output}`);
    return;
  }
  throw new Error(`Comando desconhecido: ${command}`);
}

main().catch((error) => {
  console.error(`Falha na Release Candidate: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
