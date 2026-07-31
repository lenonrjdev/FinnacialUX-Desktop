import { readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
const root = resolve(process.argv[2] ?? ".");
const version = "1.1.0";
async function updateJson(filePath, mutate) { const value = JSON.parse(await readFile(filePath, "utf8")); mutate(value); await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8"); }
await updateJson(join(root, "package.json"), (pkg) => { pkg.version = version; pkg.description = "FinnacialUX Desktop — gestão financeira offline-first com manutenção pós-lançamento, SQLCipher e atualizações assinadas."; });
try { await updateJson(join(root, "package-lock.json"), (lock) => { lock.version = version; if (lock.packages?.[""]) lock.packages[""].version = version; }); } catch (error) { if (error?.code !== "ENOENT") throw error; }
const cargoPath = join(root, "src-tauri", "Cargo.toml"); let cargo = await readFile(cargoPath, "utf8"); const pattern = /(^\[package\][\s\S]*?^version\s*=\s*")[^"]+(".*$)/m; if (!pattern.test(cargo)) throw new Error("Versão do Cargo.toml não encontrada."); cargo = cargo.replace(pattern, `$1${version}$2`); await writeFile(cargoPath, cargo, "utf8");
await updateJson(join(root, "src-tauri", "tauri.conf.json"), (tauri) => { tauri.version = version; if (tauri.bundle) { tauri.bundle.shortDescription = "Controle financeiro pessoal com manutenção segura."; tauri.bundle.longDescription = "FinnacialUX Desktop 1.1 mantém dados locais em SQLCipher e adiciona manutenção pós-lançamento, rollback protegido e atualizações assinadas."; } });
console.log(`FinnacialUX Desktop atualizado para ${version}.`);
