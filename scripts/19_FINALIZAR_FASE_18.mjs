import { readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";

const root = resolve(process.argv[2] ?? ".");
const version = "0.18.0-rc.1";

async function updateJson(filePath, mutate) {
  const value = JSON.parse(await readFile(filePath, "utf8"));
  mutate(value);
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

await updateJson(join(root, "package.json"), (pkg) => {
  pkg.version = version;
  pkg.description = "FinnacialUX Desktop — release candidate offline-first com SQLCipher, recuperação, diagnóstico e atualização assinada.";
});

try {
  await updateJson(join(root, "package-lock.json"), (lock) => {
    lock.version = version;
    if (lock.packages?.[""]) lock.packages[""].version = version;
  });
} catch (error) {
  if (error?.code !== "ENOENT") throw error;
}

const cargoPath = join(root, "src-tauri", "Cargo.toml");
let cargo = await readFile(cargoPath, "utf8");
const packageVersion = /(^\[package\][\s\S]*?^version\s*=\s*")[^"]+(".*$)/m;
if (!packageVersion.test(cargo)) throw new Error("Versão do Cargo.toml não encontrada.");
cargo = cargo.replace(packageVersion, `$1${version}$2`);
await writeFile(cargoPath, cargo, "utf8");

await updateJson(join(root, "src-tauri", "tauri.conf.json"), (tauri) => {
  tauri.version = version;
});

console.log(`FinnacialUX Desktop atualizado para ${version}.`);
