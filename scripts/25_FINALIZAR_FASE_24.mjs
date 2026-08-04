import { readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
const root = resolve(process.argv[2] ?? ".");
const version = "1.5.0";
async function updateJson(filePath, mutate) { const text = (await readFile(filePath, "utf8")).replace(/^\uFEFF/, ""); const value = JSON.parse(text); mutate(value); await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8"); }
await updateJson(join(root, "package.json"), (pkg) => { pkg.version = version; pkg.description = "FinnacialUX Desktop — gestão financeira offline-first com distribuição Windows assinada, SQLCipher e Stronghold."; });
try { await updateJson(join(root, "package-lock.json"), (lock) => { lock.version = version; if (lock.packages?.[""]) lock.packages[""].version = version; }); } catch (error) { if (error?.code !== "ENOENT") throw error; }
const cargoPath = join(root, "src-tauri", "Cargo.toml"); let cargo = await readFile(cargoPath, "utf8"); const pattern = /(^\[package\][\s\S]*?^version\s*=\s*")[^"]+(".*$)/m; if (!pattern.test(cargo)) throw new Error("Versão do Cargo.toml não encontrada."); cargo = cargo.replace(pattern, `$1${version}$2`); await writeFile(cargoPath, cargo, "utf8");
await updateJson(join(root, "src-tauri", "tauri.conf.json"), (tauri) => { tauri.version = version; if (tauri.bundle) { tauri.bundle.shortDescription = "Controle financeiro com distribuição Windows autenticada."; tauri.bundle.longDescription = "FinnacialUX Desktop 1.5 mantém dados em SQLCipher e exige Authenticode com SHA-256 e timestamp para releases oficiais."; tauri.bundle.publisher = tauri.bundle.publisher || "FinnacialUX"; } });
const ignorePath = join(root, ".gitignore"); let ignore = ""; try { ignore = await readFile(ignorePath, "utf8"); } catch (error) { if (error?.code !== "ENOENT") throw error; }
const entries = ["release/windows-signing.local.json", "src-tauri/tauri.windows.conf.json", "*.pfx", "*.p12", "*.pvk", "*.snk"];
for (const entry of entries) if (!ignore.split(/\r?\n/).includes(entry)) ignore += `${ignore.endsWith("\n") || !ignore ? "" : "\n"}${entry}\n`;
await writeFile(ignorePath, ignore, "utf8");
console.log(`FinnacialUX Desktop atualizado para ${version}.`);
