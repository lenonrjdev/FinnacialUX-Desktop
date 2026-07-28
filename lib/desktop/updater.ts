import { getVersion } from "@tauri-apps/api/app";
import { invoke } from "@tauri-apps/api/core";
import { check, type DownloadEvent, type Update } from "@tauri-apps/plugin-updater";
import publicConfig from "@/release/updater-config.json";
import { getDesktopDatabase, isDesktopRuntime } from "@/lib/desktop/database";
import type { NativeBackupRecord } from "@/types/desktop-protection";
import type {
  DesktopUpdateCheckResult,
  DesktopUpdateProgress,
  DesktopUpdaterPreferences,
  DesktopUpdaterPublicConfig,
  DesktopUpdaterStatus,
} from "@/types/desktop-updater";

const PREFERENCES_KEY = "finnacialux-desktop-updater-preferences-v1";
const DEFAULT_PREFERENCES: DesktopUpdaterPreferences = {
  automaticCheck: true,
  checkIntervalHours: 24,
  backupBeforeInstall: true,
  lastCheckedAt: null,
  skippedVersion: null,
};

function getConfig(): DesktopUpdaterPublicConfig {
  const value = publicConfig as DesktopUpdaterPublicConfig;
  return {
    enabled: Boolean(value.enabled),
    channel: "stable",
    repositoryUrl: typeof value.repositoryUrl === "string" ? value.repositoryUrl : "",
    endpoint: typeof value.endpoint === "string" ? value.endpoint : "",
    configuredAt: typeof value.configuredAt === "string" ? value.configuredAt : null,
  };
}

export function isDesktopDevelopmentBuild(): boolean {
  if (typeof window === "undefined") return false;
  return window.location.protocol === "http:" || window.location.protocol === "https:";
}

export function loadDesktopUpdaterPreferences(): DesktopUpdaterPreferences {
  if (typeof window === "undefined") return DEFAULT_PREFERENCES;
  try {
    const parsed = JSON.parse(window.localStorage.getItem(PREFERENCES_KEY) ?? "{}") as Partial<DesktopUpdaterPreferences>;
    const interval = [6, 12, 24, 48, 72].includes(Number(parsed.checkIntervalHours))
      ? Number(parsed.checkIntervalHours) as DesktopUpdaterPreferences["checkIntervalHours"]
      : DEFAULT_PREFERENCES.checkIntervalHours;
    return {
      automaticCheck: parsed.automaticCheck !== false,
      checkIntervalHours: interval,
      backupBeforeInstall: parsed.backupBeforeInstall !== false,
      lastCheckedAt: typeof parsed.lastCheckedAt === "string" ? parsed.lastCheckedAt : null,
      skippedVersion: typeof parsed.skippedVersion === "string" ? parsed.skippedVersion : null,
    };
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

export function saveDesktopUpdaterPreferences(
  preferences: DesktopUpdaterPreferences,
): DesktopUpdaterPreferences {
  if (typeof window !== "undefined") {
    window.localStorage.setItem(PREFERENCES_KEY, JSON.stringify(preferences));
  }
  return preferences;
}

function updatePreferences(patch: Partial<DesktopUpdaterPreferences>) {
  return saveDesktopUpdaterPreferences({ ...loadDesktopUpdaterPreferences(), ...patch });
}

function isAutomaticCheckDue(preferences: DesktopUpdaterPreferences): boolean {
  if (!preferences.automaticCheck) return false;
  if (!preferences.lastCheckedAt) return true;
  const last = Date.parse(preferences.lastCheckedAt);
  if (!Number.isFinite(last)) return true;
  return Date.now() - last >= preferences.checkIntervalHours * 60 * 60 * 1000;
}

function endpointHost(endpoint: string): string {
  try {
    return new URL(endpoint).host;
  } catch {
    return "Não configurado";
  }
}

export async function getDesktopUpdaterStatus(): Promise<DesktopUpdaterStatus> {
  const config = getConfig();
  return {
    currentVersion: isDesktopRuntime() ? await getVersion() : "0.5.0",
    configured: config.enabled && config.endpoint.startsWith("https://"),
    developmentBuild: isDesktopDevelopmentBuild(),
    channel: "stable",
    repositoryUrl: config.repositoryUrl,
    endpointHost: endpointHost(config.endpoint),
    preferences: loadDesktopUpdaterPreferences(),
  };
}

export async function checkDesktopUpdate(force = false): Promise<DesktopUpdateCheckResult> {
  const status = await getDesktopUpdaterStatus();
  if (!isDesktopRuntime()) {
    return { checked: false, reason: "A verificação está disponível apenas no aplicativo desktop.", update: null };
  }
  if (!status.configured) {
    return { checked: false, reason: "O canal de atualizações ainda não foi configurado.", update: null };
  }
  if (status.developmentBuild) {
    return { checked: false, reason: "Atualizações são verificadas somente no aplicativo instalado.", update: null };
  }
  if (!force && !isAutomaticCheckDue(status.preferences)) {
    return { checked: false, reason: "A próxima verificação automática ainda não está vencida.", update: null };
  }

  const checkedAt = new Date().toISOString();
  try {
    const update = await check({ timeout: 30_000 });
    updatePreferences({ lastCheckedAt: checkedAt });
    if (!update) return { checked: true, reason: "Você já está usando a versão mais recente.", update: null };
    if (!force && status.preferences.skippedVersion === update.version) {
      await update.close();
      return { checked: true, reason: `A versão ${update.version} está ignorada neste computador.`, update: null };
    }
    return { checked: true, reason: `A versão ${update.version} está disponível.`, update };
  } catch (caught) {
    const message = caught instanceof Error ? caught.message : String(caught);
    throw new Error(`Não foi possível verificar atualizações: ${message}`);
  }
}

export function skipDesktopUpdate(version: string | null): DesktopUpdaterPreferences {
  return updatePreferences({ skippedVersion: version });
}

export async function createPreUpdateBackup(credential: string): Promise<NativeBackupRecord> {
  await getDesktopDatabase();
  return invoke<NativeBackupRecord>("create_pre_update_backup", { credential });
}

export async function installDesktopUpdate(
  update: Update,
  preferences: DesktopUpdaterPreferences,
  backupCredential: string | null,
  onProgress: (progress: DesktopUpdateProgress) => void,
): Promise<void> {
  if (preferences.backupBeforeInstall) {
    if (!backupCredential) throw new Error("O cofre local não disponibilizou a chave do backup pré-atualização.");
    onProgress({
      phase: "backup",
      downloadedBytes: 0,
      totalBytes: null,
      percent: 0,
      message: "Criando backup criptografado antes da atualização...",
    });
    await createPreUpdateBackup(backupCredential);
  }

  let downloadedBytes = 0;
  let totalBytes: number | null = null;
  let exitPrepared = false;
  try {
    await update.download((event: DownloadEvent) => {
      if (event.event === "Started") {
        totalBytes = event.data.contentLength ?? null;
        onProgress({
          phase: "downloading",
          downloadedBytes: 0,
          totalBytes,
          percent: 0,
          message: "Baixando a atualização assinada...",
        });
        return;
      }
      if (event.event === "Progress") {
        downloadedBytes += event.data.chunkLength;
        const percent = totalBytes ? Math.min(100, Math.round(downloadedBytes / totalBytes * 100)) : 0;
        onProgress({
          phase: "downloading",
          downloadedBytes,
          totalBytes,
          percent,
          message: totalBytes ? `Baixando atualização: ${percent}%` : "Baixando a atualização assinada...",
        });
        return;
      }
      onProgress({
        phase: "installing",
        downloadedBytes,
        totalBytes,
        percent: 100,
        message: "Download concluído. O instalador está sendo iniciado...",
      });
    }, { timeout: 180_000 });
    await invoke("prepare_for_update_exit");
    exitPrepared = true;
    onProgress({
      phase: "installing",
      downloadedBytes,
      totalBytes,
      percent: 100,
      message: "Download validado. O instalador está sendo iniciado...",
    });
    await update.install();
  } catch (caught) {
    if (exitPrepared) await invoke("resume_after_update_failure").catch(() => undefined);
    const message = caught instanceof Error ? caught.message : String(caught);
    onProgress({
      phase: "failed",
      downloadedBytes,
      totalBytes,
      percent: 0,
      message,
    });
    throw new Error(`A atualização não pôde ser instalada: ${message}`);
  }
}
