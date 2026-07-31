import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { access, copyFile, mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

function sha256File(filePath) {
  return new Promise((resolve, reject) => {
    const hash = createHash("sha256");
    const stream = createReadStream(filePath);
    stream.on("error", reject);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("end", () => resolve(hash.digest("hex")));
  });
}

async function exists(filePath) { try { await access(filePath); return true; } catch { return false; } }
async function readJson(filePath) { return JSON.parse(await readFile(filePath, "utf8")); }
function cargoVersion(text) { return text.match(/^\[package\][\s\S]*?^version\s*=\s*"([^"]+)"/m)?.[1] ?? ""; }
function cargoDependencies(text) {
  const section = text.match(/^\[dependencies\]\s*([\s\S]*?)(?=^\[|\s*$)/m)?.[1] ?? "";
  return section.split(/\r?\n/).map((line) => line.trim()).filter((line) => line && !line.startsWith("#") && line.includes("=")).map((line) => {
    const [name, ...valueParts] = line.split("="); return { name: name.trim(), declaration: valueParts.join("=").trim() };
  }).sort((left, right) => left.name.localeCompare(right.name));
}

async function verifySource(root) {
  const config = await readJson(path.join(root, "release", "stable-release.json"));
  const freeze = await readJson(path.join(root, "release", "schema-freeze-14.json"));
  const pkg = await readJson(path.join(root, "package.json"));
  const tauri = await readJson(path.join(root, "src-tauri", "tauri.conf.json"));
  const cargoText = await readFile(path.join(root, "src-tauri", "Cargo.toml"), "utf8");
  const expectedVersion = String(config.version);
  const expectedSchema = Number(config.schemaVersion);
  const promotedFrom = String(config.promotedFrom ?? "");
  const versions = [String(pkg.version), String(tauri.version), cargoVersion(cargoText)];
  if (versions.some((version) => version !== expectedVersion)) throw new Error(`Versões divergentes: ${versions.join(", ")}`);
  if (config.channel !== "stable" || !config.schemaFrozen || !promotedFrom || config.prerelease !== false || config.makeLatest !== true) {
    throw new Error("Configuração da release estável inválida.");
  }
  const migrationsDirectory = path.join(root, "src-tauri", "migrations");
  const actualFiles = (await readdir(migrationsDirectory)).filter((name) => /^\d{4}_.+\.sql$/.test(name)).sort();
  if (actualFiles.length !== freeze.migrationCount || actualFiles.at(-1)?.slice(0, 4) !== String(expectedSchema).padStart(4, "0")) {
    throw new Error(`O schema não está congelado: ${actualFiles.length} migrations, última ${actualFiles.at(-1) ?? "ausente"}.`);
  }
  for (const migration of freeze.migrations) {
    const hash = await sha256File(path.join(migrationsDirectory, migration.file));
    if (hash !== migration.sha256) throw new Error(`Migration alterada após congelamento: ${migration.file}`);
  }
  const unexpectedMigration = actualFiles.find((name) => Number(name.slice(0, 4)) > expectedSchema);
  if (unexpectedMigration) throw new Error(`Migration posterior ao schema congelado encontrada: ${unexpectedMigration}`);
  for (const source of ["encrypted_database.rs", "protection.rs", "diagnostics.rs"]) {
    const text = await readFile(path.join(root, "src-tauri", "src", source), "utf8");
    if (!text.includes(`CURRENT_SCHEMA_VERSION: i64 = ${expectedSchema}`)) throw new Error(`${source} não reconhece o schema ${expectedSchema}.`);
  }
  return { config, freeze, pkg, tauri, cargoText, expectedVersion, expectedSchema, promotedFrom };
}

async function verifyPromotionEvidence(root, directoryArg, suppliedSource) {
  const source = suppliedSource ?? await verifySource(root);
  const directory = path.resolve(root, directoryArg ?? path.join("releases", source.promotedFrom));
  const fromCandidate = source.promotedFrom.includes("-rc.");
  const validationName = fromCandidate ? "RC_VALIDATION_REPORT.json" : "STABLE_VALIDATION_REPORT.json";
  const validationPath = path.join(directory, validationName);
  const manifestPath = path.join(directory, "release-manifest.json");
  const validation = await readJson(validationPath).catch(() => null);
  const manifest = await readJson(manifestPath).catch(() => null);
  if (!validation || validation.version !== source.promotedFrom || validation.schemaVersion !== source.expectedSchema) {
    throw new Error(`Relatório de validação da versão anterior ausente ou incompatível: ${validationName}`);
  }
  const expectedStatus = fromCandidate ? "approved-for-prerelease" : "approved-for-stable";
  if (validation.manualMatrixComplete !== true || validation.status !== expectedStatus) throw new Error("A versão de origem ainda não possui homologação manual completa.");
  const expectedChannel = fromCandidate ? "release-candidate" : "stable";
  if (!manifest || manifest.version !== source.promotedFrom || manifest.channel !== expectedChannel || Boolean(manifest.prerelease) !== fromCandidate) {
    throw new Error("Manifesto da versão de origem ausente ou inválido.");
  }
  return { directory, validation, manifest, validationName, validationSha256: await sha256File(validationPath), manifestSha256: await sha256File(manifestPath) };
}

async function createInventory(source) {
  const dependencies = Object.entries(source.pkg.dependencies ?? {}).map(([name, declaration]) => ({ name, declaration, scope: "runtime" }));
  const development = Object.entries(source.pkg.devDependencies ?? {}).map(([name, declaration]) => ({ name, declaration, scope: "development" }));
  return { formatVersion: 1, product: source.config.product, version: source.config.version, generatedAt: new Date().toISOString(), npm: [...dependencies, ...development].sort((a,b)=>a.name.localeCompare(b.name)), cargo: cargoDependencies(source.cargoText), note: "Inventário declarativo das dependências diretas usadas na versão estável." };
}

async function prepareStableManifest(root, promotionDirectoryArg) {
  const source = await verifySource(root);
  const evidence = await verifyPromotionEvidence(root, promotionDirectoryArg, source);
  const output = path.join(root, "releases", source.expectedVersion);
  await mkdir(output, { recursive: true });
  const criticalFiles = ["package.json", "package-lock.json", "src-tauri/Cargo.toml", "src-tauri/Cargo.lock", "src-tauri/tauri.conf.json", "release/schema-freeze-14.json", "release/stable-release.json"];
  const hashes = [];
  for (const relative of criticalFiles) { const filePath = path.join(root, relative); if (await exists(filePath)) hashes.push({ file: relative.replaceAll("\\", "/"), sha256: await sha256File(filePath) }); }
  for (const migration of source.freeze.migrations) hashes.push({ file: `src-tauri/migrations/${migration.file}`, sha256: migration.sha256 });
  const buildManifest = { formatVersion: 2, product: source.config.product, version: source.expectedVersion, channel: "stable", schemaVersion: source.expectedSchema, schemaFrozen: true, tag: source.config.tag, target: source.config.target, promotedFrom: source.promotedFrom, promotedFromTag: source.config.promotedFromTag, generatedAt: new Date().toISOString(), promotionEvidence: { validationFile: evidence.validationName, validationReportSha256: evidence.validationSha256, releaseManifestSha256: evidence.manifestSha256, manualMatrixComplete: true }, sourceHashes: hashes };
  await writeFile(path.join(output, "STABLE_BUILD_MANIFEST.json"), `${JSON.stringify(buildManifest, null, 2)}\n`, "utf8");
  await writeFile(path.join(output, "DEPENDENCY_INVENTORY.json"), `${JSON.stringify(await createInventory(source), null, 2)}\n`, "utf8");
  const checklistName = `STABLE_CHECKLIST_${source.expectedVersion.replaceAll(".", "_")}.md`;
  const checklistPath = path.join(root, "release", checklistName);
  if (await exists(checklistPath)) await copyFile(checklistPath, path.join(output, "STABLE_CHECKLIST.md"));
  for (const document of ["PRIVACY.md", "SECURITY.md", "SUPPORT.md"]) if (await exists(path.join(root, document))) await copyFile(path.join(root, document), path.join(output, document));
  return output;
}

async function verifyStableArtifacts(root, releaseDirectoryArg) {
  const source = await verifySource(root);
  const directory = path.resolve(root, releaseDirectoryArg ?? path.join("releases", source.expectedVersion));
  const installerName = `FinnacialUX-Desktop_${source.expectedVersion}_x64-setup.exe`;
  const required = source.config.requiredArtifacts.filter((name) => name !== "STABLE_VALIDATION_REPORT.json");
  for (const name of required) { const info = await stat(path.join(directory, name)).catch(() => null); if (!info?.isFile() || info.size <= 0) throw new Error(`Artefato obrigatório ausente ou vazio: ${name}`); }
  const installerHash = await sha256File(path.join(directory, installerName));
  const sums = await readFile(path.join(directory, "SHA256SUMS.txt"), "utf8");
  if (!sums.includes(`${installerHash}  ${installerName}`)) throw new Error("SHA256SUMS.txt não corresponde ao instalador estável.");
  const manifest = await readJson(path.join(directory, "release-manifest.json"));
  if (manifest.version !== source.expectedVersion || manifest.sha256 !== installerHash || manifest.prerelease !== false || manifest.channel !== "stable" || manifest.schemaVersion !== source.expectedSchema) throw new Error("Manifesto final não identifica corretamente a versão estável.");
  const latest = await readJson(path.join(directory, "latest.json"));
  const platform = latest.platforms?.["windows-x86_64"];
  if (latest.version !== source.expectedVersion || !platform?.signature || !String(platform.url ?? "").includes(`/desktop-v${source.expectedVersion}/${installerName}`)) throw new Error("latest.json inválido para o canal estável.");
  const validationPath = path.join(directory, "STABLE_VALIDATION_REPORT.json");
  const existing = await readJson(validationPath).catch(() => null);
  if (existing?.manualMatrixComplete === true && existing?.status === "approved-for-stable") {
    if (existing.version !== source.expectedVersion || existing.schemaVersion !== source.expectedSchema || existing.installerSha256 !== installerHash || existing.latestChannelConfirmed !== true) throw new Error("O relatório manual estável não corresponde aos artefatos atuais.");
  } else {
    const validation = { formatVersion: 2, product: source.config.product, version: source.expectedVersion, schemaVersion: source.expectedSchema, promotedFrom: source.promotedFrom, validatedAt: new Date().toISOString(), installer: installerName, installerSha256: installerHash, updaterSignaturePresent: true, sourceManifestPresent: true, manualMatrixComplete: false, latestChannelConfirmed: false, status: "automatic-checks-passed" };
    await writeFile(validationPath, `${JSON.stringify(validation, null, 2)}\n`, "utf8");
  }
  return directory;
}

async function main() {
  const [command = "verify-source", rootArg = ".", directoryArg] = process.argv.slice(2);
  const root = path.resolve(rootArg);
  if (command === "verify-source") { const source = await verifySource(root); console.log(`Release estável ${source.expectedVersion}: fonte validada, schema ${source.expectedSchema} congelado.`); return; }
  if (command === "verify-promotion" || command === "verify-rc") { const source = await verifySource(root); const result = await verifyPromotionEvidence(root, directoryArg, source); console.log(`Versão de origem homologada: ${result.directory}`); return; }
  if (command === "prepare") { const output = await prepareStableManifest(root, directoryArg); console.log(`Manifestos da release estável preparados em: ${output}`); return; }
  if (command === "verify-artifacts") { const output = await verifyStableArtifacts(root, directoryArg); console.log(`Artefatos da release estável validados em: ${output}`); return; }
  throw new Error(`Comando desconhecido: ${command}`);
}
main().catch((error) => { console.error(`Falha na release estável: ${error instanceof Error ? error.message : String(error)}`); process.exitCode = 1; });
