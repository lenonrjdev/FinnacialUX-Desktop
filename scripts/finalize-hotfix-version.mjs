import { readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";

const root = resolve(process.argv[2] ?? ".");
const version = process.argv[3] ?? "0.8.6";

const cargoPath = join(root, "src-tauri", "Cargo.toml");
const tauriPath = join(root, "src-tauri", "tauri.conf.json");

let cargo = await readFile(cargoPath, "utf8");
const packageSection = /(^\[package\][\s\S]*?^version\s*=\s*")[^"]+(".*$)/m;
if (!packageSection.test(cargo)) {
  throw new Error("Não foi possível localizar a versão do pacote em Cargo.toml.");
}
cargo = cargo.replace(packageSection, `$1${version}$2`);
await writeFile(cargoPath, cargo, "utf8");

const tauri = JSON.parse(await readFile(tauriPath, "utf8"));
tauri.version = version;
await writeFile(tauriPath, `${JSON.stringify(tauri, null, 2)}\n`, "utf8");

console.log(`Versão nativa atualizada para ${version}.`);
