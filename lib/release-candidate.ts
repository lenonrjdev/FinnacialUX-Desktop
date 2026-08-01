import stableReleaseJson from "@/release/stable-release.json";
import type {
  ParsedDesktopVersion,
  ReleaseConfig,
  ReleaseReadinessCheck,
  ReleaseReadinessReport,
  ReleaseSnapshot,
  ReleaseChannel,
} from "@/types/release-candidate";

export const stableReleaseConfig = stableReleaseJson as ReleaseConfig;
export const releaseCandidateConfig = stableReleaseConfig;

export function parseDesktopVersion(value: string): ParsedDesktopVersion {
  const match = /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?$/.exec(value.trim());
  if (!match) return { valid: false, major: 0, minor: 0, patch: 0, prerelease: null };
  return {
    valid: true,
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
    prerelease: match[4] ?? null,
  };
}

export function releaseChannel(version: string, developmentBuild = false): ReleaseChannel {
  if (developmentBuild) return "development";
  const parsed = parseDesktopVersion(version);
  if (!parsed.valid) return "development";
  return parsed.prerelease?.startsWith("rc.") ? "release-candidate" : "stable";
}

export function releaseTag(version: string): string {
  return `desktop-v${version}`;
}

export function releaseAssetName(version: string): string {
  return `FinnacialUX-Desktop_${version}_x64-setup.exe`;
}

function check(
  id: string,
  title: string,
  detail: string,
  status: ReleaseReadinessCheck["status"],
  required = true,
): ReleaseReadinessCheck {
  return { id, title, detail, status, required };
}

export function createReleaseReadinessReport(
  snapshot: ReleaseSnapshot,
  config: ReleaseConfig = stableReleaseConfig,
): ReleaseReadinessReport {
  const channel = releaseChannel(snapshot.version, snapshot.developmentBuild);
  const checks: ReleaseReadinessCheck[] = [
    check(
      "version",
      "Versão estável",
      snapshot.version === config.version
        ? `${snapshot.version} corresponde à versão estável publicada.`
        : `Esperado ${config.version}; encontrado ${snapshot.version}.`,
      snapshot.version === config.version ? "passed" : "blocked",
    ),
    check(
      "schema",
      "Schema congelado",
      snapshot.schemaVersion === config.schemaVersion && config.schemaFrozen
        ? `Schema ${config.schemaVersion} preservado desde a Release Candidate.`
        : `O banco precisa permanecer no schema ${config.schemaVersion}.`,
      snapshot.schemaVersion === config.schemaVersion && config.schemaFrozen ? "passed" : "blocked",
    ),
    check(
      "promotion",
      "Procedência homologada",
      config.promotedFrom
        ? `Promovida a partir de ${config.promotedFrom}, sem alterar o formato dos dados.`
        : "A versão estável precisa registrar a Release Candidate de origem.",
      config.promotedFrom ? "passed" : "blocked",
    ),
    check(
      "runtime",
      "Build instalado",
      snapshot.developmentBuild
        ? "O painel está aberto em desenvolvimento; confirme também o instalador estável."
        : "Aplicativo executado a partir de um build instalado.",
      snapshot.developmentBuild ? "attention" : "passed",
      false,
    ),
    check(
      "updater",
      "Canal de atualização assinado",
      snapshot.updaterConfigured
        ? "Chave pública e endpoint HTTPS do canal estável estão configurados."
        : "Configure o updater antes de distribuir a versão estável.",
      snapshot.updaterConfigured ? "passed" : "blocked",
    ),
    check(
      "backup",
      "Backup pré-atualização",
      snapshot.backupBeforeInstall
        ? "Cópia criptografada está habilitada antes de instalar atualizações."
        : "Ative o backup pré-atualização para proteger upgrades futuros.",
      snapshot.backupBeforeInstall ? "passed" : "blocked",
    ),
    check(
      "platform",
      "Plataforma suportada",
      snapshot.windowsRuntime
        ? "Ambiente Windows detectado."
        : "O instalador estável é distribuído para Windows 10 e Windows 11 x64.",
      snapshot.windowsRuntime ? "passed" : "attention",
      false,
    ),
  ];
  const passed = checks.filter((item) => item.status === "passed").length;
  const attention = checks.filter((item) => item.status === "attention").length;
  const blocked = checks.filter((item) => item.status === "blocked").length;
  return {
    channel,
    expectedVersion: config.version,
    promotedFrom: config.promotedFrom ?? null,
    tag: releaseTag(config.version),
    assetName: releaseAssetName(config.version),
    ready: checks.every((item) => !item.required || item.status === "passed"),
    passed,
    attention,
    blocked,
    checks,
  };
}

export function formatReleaseReadinessSummary(report: ReleaseReadinessReport): string {
  const lines = [
    `FinnacialUX Desktop ${report.expectedVersion}`,
    `Canal: ${report.channel}`,
    `Origem: ${report.promotedFrom ?? "não registrada"}`,
    `Tag: ${report.tag}`,
    `Instalador: ${report.assetName}`,
    `Estado: ${report.ready ? "versão estável íntegra" : "pendências encontradas"}`,
    "",
    ...report.checks.map((item) => `[${item.status.toUpperCase()}] ${item.title}: ${item.detail}`),
  ];
  return lines.join("\n");
}
