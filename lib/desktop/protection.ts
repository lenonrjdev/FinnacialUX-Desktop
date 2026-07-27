import { invoke } from "@tauri-apps/api/core";
import { open, save } from "@tauri-apps/plugin-dialog";
import { error as logError, info as logInfo, warn as logWarn } from "@tauri-apps/plugin-log";
import { closeDesktopDatabase, getDesktopDatabase, isDesktopRuntime } from "@/lib/desktop/database";
import { clearLocalSession } from "@/lib/desktop/session";
import type {
  AutomaticBackupResult,
  BackupEncryptionMode,
  BackupHeader,
  BackupPreview,
  DiagnosticReport,
  IntegrityReport,
  NativeBackupPreferences,
  NativeBackupRecord,
  RecoveryStatus,
  RestoreOperationResult,
} from "@/types/desktop-protection";

const SAFE_MODE_KEY = "finnacialux-desktop-safe-mode";

function dateStamp() {
  return new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
}

function normalizeError(caught: unknown): Error {
  if (caught instanceof Error) return caught;
  return new Error(typeof caught === "string" ? caught : "O aplicativo encontrou um erro inesperado.");
}

async function safeLog(level: "info" | "warn" | "error", event: string, detail?: string) {
  if (!isDesktopRuntime()) return;
  const safeEvent = event.replace(/[^a-zA-Z0-9_.-]/g, "_").slice(0, 80);
  const safeDetail = detail?.replace(/[\r\n\t]/g, " ").slice(0, 240);
  const message = safeDetail ? `${safeEvent} ${safeDetail}` : safeEvent;
  try {
    if (level === "error") await logError(message);
    else if (level === "warn") await logWarn(message);
    else await logInfo(message);
  } catch {
    // Logs nunca devem interromper uma operação financeira.
  }
}

export function isSafeModeEnabled(): boolean {
  if (typeof window === "undefined") return false;
  return window.sessionStorage.getItem(SAFE_MODE_KEY) === "1";
}

export function setSafeModeEnabled(enabled: boolean) {
  if (typeof window === "undefined") return;
  if (enabled) window.sessionStorage.setItem(SAFE_MODE_KEY, "1");
  else window.sessionStorage.removeItem(SAFE_MODE_KEY);
  window.dispatchEvent(new CustomEvent("finnacialux-safe-mode-change", { detail: enabled }));
}

export async function chooseBackupDestination(): Promise<string | null> {
  if (!isDesktopRuntime()) return null;
  return save({
    title: "Salvar backup do FinnacialUX",
    defaultPath: `FinnacialUX-backup-${dateStamp()}.fuxbackup`,
    filters: [{ name: "Backup FinnacialUX", extensions: ["fuxbackup"] }],
  });
}

export async function chooseBackupSource(): Promise<string | null> {
  if (!isDesktopRuntime()) return null;
  const selected = await open({
    title: "Selecionar backup do FinnacialUX",
    multiple: false,
    directory: false,
    filters: [{ name: "Backup FinnacialUX", extensions: ["fuxbackup"] }],
  });
  return typeof selected === "string" ? selected : null;
}

export async function createManualBackup(
  destination: string,
  encryptionMode: BackupEncryptionMode,
  credential?: string,
): Promise<NativeBackupRecord> {
  try {
    await getDesktopDatabase();
    const result = await invoke<{ record: NativeBackupRecord; message: string }>("create_manual_backup", {
      destination,
      encryptionMode,
      credential: credential ?? null,
    });
    await safeLog("info", "backup.manual.created", `id=${result.record.id} mode=${encryptionMode}`);
    return result.record;
  } catch (caught) {
    const problem = normalizeError(caught);
    await safeLog("error", "backup.manual.failed", problem.message);
    throw problem;
  }
}

export async function runAutomaticBackup(credential?: string): Promise<AutomaticBackupResult> {
  try {
    await getDesktopDatabase();
    const result = await invoke<AutomaticBackupResult>("run_automatic_backup", {
      credential: credential ?? null,
    });
    if (result.created) await safeLog("info", "backup.automatic.created");
    return result;
  } catch (caught) {
    const problem = normalizeError(caught);
    await safeLog("error", "backup.automatic.failed", problem.message);
    throw problem;
  }
}

export async function listNativeBackups(): Promise<NativeBackupRecord[]> {
  await getDesktopDatabase();
  return invoke<NativeBackupRecord[]>("list_backups");
}

export async function removeNativeBackup(backupId: string, deleteFile: boolean): Promise<void> {
  await getDesktopDatabase();
  await invoke("remove_backup_record", { backupId, deleteFile });
  await safeLog("info", "backup.record.removed", `deleteFile=${deleteFile}`);
}

export function inspectNativeBackup(source: string): Promise<BackupHeader> {
  return invoke<BackupHeader>("inspect_backup_header", { source });
}

export function previewNativeBackup(source: string, credential?: string): Promise<BackupPreview> {
  return invoke<BackupPreview>("preview_backup", { source, credential: credential ?? null });
}

export async function restoreNativeBackup(
  source: string,
  credential?: string,
  safetyCredential?: string,
): Promise<RestoreOperationResult> {
  try {
    await getDesktopDatabase();
    const result = await invoke<RestoreOperationResult>("restore_backup", {
      source,
      credential: credential ?? null,
      safetyCredential: safetyCredential ?? null,
    });
    await closeDesktopDatabase();
    clearLocalSession();
    setSafeModeEnabled(false);
    await safeLog("warn", "backup.restored");
    return result;
  } catch (caught) {
    const problem = normalizeError(caught);
    await safeLog("error", "backup.restore.failed", problem.message);
    throw problem;
  }
}

export async function runDatabaseIntegrityCheck(): Promise<IntegrityReport> {
  await getDesktopDatabase();
  return invoke<IntegrityReport>("run_integrity_check");
}

export async function getDesktopDiagnostics(): Promise<DiagnosticReport> {
  await getDesktopDatabase();
  return invoke<DiagnosticReport>("get_diagnostics", { safeMode: isSafeModeEnabled() });
}

export async function getNativeBackupPreferences(): Promise<NativeBackupPreferences> {
  await getDesktopDatabase();
  return invoke<NativeBackupPreferences>("get_backup_preferences");
}

export async function saveNativeBackupPreferences(preferences: NativeBackupPreferences): Promise<NativeBackupPreferences> {
  await getDesktopDatabase();
  return invoke<NativeBackupPreferences>("save_backup_preferences", { preferences });
}

export async function chooseDiagnosticDestination(): Promise<string | null> {
  if (!isDesktopRuntime()) return null;
  return save({
    title: "Exportar diagnóstico do FinnacialUX",
    defaultPath: `FinnacialUX-diagnostico-${dateStamp()}.fuxdiag`,
    filters: [{ name: "Diagnóstico FinnacialUX", extensions: ["fuxdiag"] }],
  });
}

export async function exportDiagnosticPackage(destination: string): Promise<string> {
  await getDesktopDatabase();
  const path = await invoke<string>("export_diagnostic_package", {
    destination,
    safeMode: isSafeModeEnabled(),
  });
  await safeLog("info", "diagnostic.exported");
  return path;
}

export function openDesktopFolder(folder: "data" | "backups" | "logs"): Promise<string> {
  return invoke<string>("open_app_folder", { folder });
}

export function getRecoveryStatus(): Promise<RecoveryStatus> {
  return invoke<RecoveryStatus>("get_recovery_status");
}

export function acknowledgeRecovery(): Promise<void> {
  return invoke("acknowledge_recovery");
}
