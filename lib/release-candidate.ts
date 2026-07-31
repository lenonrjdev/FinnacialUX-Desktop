import releaseConfigJson from "@/release/release-candidate.json";
import type {
  ParsedDesktopVersion,
  ReleaseCandidateConfig,
  ReleaseCandidateSnapshot,
  ReleaseChannel,
  ReleaseReadinessCheck,
  ReleaseReadinessReport,
} from "@/types/release-candidate";

export const releaseCandidateConfig = releaseConfigJson as ReleaseCandidateConfig;

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
  snapshot: ReleaseCandidateSnapshot,
  config: ReleaseCandidateConfig = releaseCandidateConfig,
): ReleaseReadinessReport {
  const channel = releaseChannel(snapshot.version, snapshot.developmentBuild);
  const checks: ReleaseReadinessCheck[] = [
    check(
      "version",
      "Versão candidata",
      snapshot.version === config.version
        ? `${snapshot.version} corresponde ao candidato homologado.`
        : `Esperado ${config.version}; encontrado ${snapshot.version}.`,
      snapshot.version === config.version ? "passed" : "blocked",
    ),
    check(
      "schema",
      "Schema congelado",
      snapshot.schemaVersion === config.schemaVersion && config.schemaFrozen
        ? `Schema ${config.schemaVersion} congelado para a versão 1.0.`
        : `O banco precisa permanecer no schema ${config.schemaVersion}.`,
      snapshot.schemaVersion === config.schemaVersion && config.schemaFrozen ? "passed" : "blocked",
    ),
    check(
      "runtime",
      "Build instalado",
      snapshot.developmentBuild
        ? "O painel está aberto no modo de desenvolvimento; homologue também o instalador NSIS."
        : "Aplicativo executado a partir de um build instalado.",
      snapshot.developmentBuild ? "attention" : "passed",
      false,
    ),
    check(
      "updater",
      "Atualizador assinado",
      snapshot.updaterConfigured
        ? "Chave pública e endpoint HTTPS estão configurados."
        : "Configure o updater antes de distribuir o candidato.",
      snapshot.updaterConfigured ? "passed" : "blocked",
    ),
    check(
      "backup",
      "Backup pré-atualização",
      snapshot.backupBeforeInstall
        ? "Cópia criptografada está habilitada antes de instalar atualizações."
        : "Ative o backup pré-atualização para a homologação.",
      snapshot.backupBeforeInstall ? "passed" : "blocked",
    ),
    check(
      "platform",
      "Plataforma de homologação",
      snapshot.windowsRuntime
        ? "Ambiente Windows detectado."
        : "O instalador candidato deve ser validado no Windows 10 e no Windows 11.",
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
    `Tag: ${report.tag}`,
    `Instalador: ${report.assetName}`,
    `Estado: ${report.ready ? "pronto para homologação" : "pendências encontradas"}`,
    "",
    ...report.checks.map((item) => `[${item.status.toUpperCase()}] ${item.title}: ${item.detail}`),
  ];
  return lines.join("\n");
}
