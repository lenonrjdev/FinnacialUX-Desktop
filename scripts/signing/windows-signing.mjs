import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

async function readJson(filePath) {
  const text = await readFile(filePath, "utf8");
  return JSON.parse(text.replace(/^\uFEFF/, ""));
}

function normalizeThumbprint(value) {
  return String(value ?? "").replace(/[^a-fA-F0-9]/g, "").toUpperCase();
}

function validateConfig(config, { allowExample = false } = {}) {
  const errors = [];
  const providers = new Set(["certificate-store", "pfx", "custom-command"]);
  if (config?.formatVersion !== 1) errors.push("formatVersion deve ser 1");
  if (!providers.has(config?.provider)) errors.push("provider inválido");
  if (!String(config?.publisherDisplayName ?? "").trim()) errors.push("publisherDisplayName ausente");
  if (!String(config?.expectedPublisher ?? "").trim()) errors.push("expectedPublisher ausente");
  if (!/^https?:\/\//i.test(String(config?.timestampUrl ?? ""))) errors.push("timestampUrl inválido");
  if (config?.digestAlgorithm !== "SHA256" || config?.timestampDigestAlgorithm !== "SHA256") errors.push("SHA256 é obrigatório");
  if (config?.provider === "certificate-store") {
    const thumbprint = normalizeThumbprint(config?.certificateStore?.thumbprint);
    const placeholder = /COLE_|THUMBPRINT/i.test(String(config?.certificateStore?.thumbprint ?? ""));
    if ((!allowExample || !placeholder) && !/^[A-F0-9]{40,64}$/.test(thumbprint)) errors.push("thumbprint inválido");
  }
  if (config?.provider === "pfx" && !String(config?.pfx?.path ?? "").trim()) errors.push("pfx.path ausente");
  if (config?.provider === "custom-command") {
    if (!String(config?.customCommand?.cmd ?? "").trim()) errors.push("customCommand.cmd ausente");
    const args = Array.isArray(config?.customCommand?.args) ? config.customCommand.args : [];
    if (!args.some((item) => String(item).includes("{file}") || String(item).includes("%1"))) errors.push("customCommand sem marcador de arquivo");
  }
  return errors;
}

function sha256File(filePath) {
  return new Promise((resolve, reject) => {
    const hash = createHash("sha256");
    const stream = createReadStream(filePath);
    stream.on("error", reject);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("end", () => resolve(hash.digest("hex")));
  });
}

async function verifyReport(root, reportPath) {
  const report = await readJson(path.resolve(root, reportPath));
  if (report?.status !== "approved" || report?.allValid !== true || report?.timestampComplete !== true || report?.publisherMatch !== true) {
    throw new Error("Relatório Authenticode não está aprovado.");
  }
  if (!Array.isArray(report.artifacts) || report.artifacts.length < 2) throw new Error("Relatório Authenticode incompleto.");
  for (const artifact of report.artifacts) {
    if (artifact.signatureStatus !== "Valid" || artifact.timestampPresent !== true || !/^[a-f0-9]{64}$/i.test(String(artifact.sha256 ?? ""))) {
      throw new Error(`Artefato Authenticode inválido: ${artifact.fileName ?? "desconhecido"}`);
    }
  }
  console.log(`Relatório Authenticode aprovado para ${report.version}.`);
}

async function main() {
  const [command = "validate-config", rootArg = ".", fileArg] = process.argv.slice(2);
  const root = path.resolve(rootArg);
  if (command === "validate-config" || command === "validate-example") {
    const filePath = path.resolve(root, fileArg ?? "release/windows-signing.example.json");
    const config = await readJson(filePath);
    const errors = validateConfig(config, { allowExample: command === "validate-example" });
    if (errors.length) throw new Error(errors.join("; "));
    console.log(`Configuração de assinatura válida: ${filePath}`);
    return;
  }
  if (command === "verify-report") {
    await verifyReport(root, fileArg ?? "releases/1.5.0/WINDOWS_AUTHENTICODE_REPORT.json");
    return;
  }
  if (command === "hash") {
    console.log(await sha256File(path.resolve(root, fileArg)));
    return;
  }
  throw new Error(`Comando desconhecido: ${command}`);
}

main().catch((error) => {
  console.error(`Falha na política de assinatura Windows: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
