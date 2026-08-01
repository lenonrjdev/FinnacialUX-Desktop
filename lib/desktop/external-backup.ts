import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { ApiError } from "@/lib/api/client";
import { hasTauriRuntime } from "@/lib/desktop/runtime";
import type {
  ExternalBackupDestinationStatus,
  ExternalBackupMirrorResult,
  ExternalBackupPreferences,
  ExternalBackupVerification,
} from "@/types/external-backup";

function requireDesktop() {
  if (!hasTauriRuntime()) throw new ApiError("A redundância externa está disponível somente no aplicativo Desktop.", 400);
}

export async function chooseExternalBackupDirectory(): Promise<string | null> {
  if (!hasTauriRuntime()) return null;
  const selected = await open({
    title: "Selecionar destino externo para backups criptografados",
    directory: true,
    multiple: false,
  });
  return typeof selected === "string" ? selected : null;
}

export function getExternalBackupPreferences(): Promise<ExternalBackupPreferences> {
  requireDesktop();
  return invoke<ExternalBackupPreferences>("external_backup_get_preferences");
}

export function saveExternalBackupPreferences(preferences: ExternalBackupPreferences): Promise<ExternalBackupPreferences> {
  requireDesktop();
  return invoke<ExternalBackupPreferences>("external_backup_save_preferences", { preferences });
}

export function getExternalBackupDestinationStatus(): Promise<ExternalBackupDestinationStatus> {
  requireDesktop();
  return invoke<ExternalBackupDestinationStatus>("external_backup_get_destination_status");
}

export function mirrorBackupExternally(sourceFilePath: string): Promise<ExternalBackupMirrorResult> {
  requireDesktop();
  return invoke<ExternalBackupMirrorResult>("external_backup_mirror", { sourceFilePath });
}

export function verifyExternalBackupDestination(): Promise<ExternalBackupVerification> {
  requireDesktop();
  return invoke<ExternalBackupVerification>("external_backup_verify");
}

export function openExternalBackupDestination(): Promise<string> {
  requireDesktop();
  return invoke<string>("external_backup_open_destination");
}
