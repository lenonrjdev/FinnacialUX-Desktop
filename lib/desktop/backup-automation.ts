import { invoke } from "@tauri-apps/api/core";
import { ApiError } from "@/lib/api/client";
import { hasTauriRuntime } from "@/lib/desktop/runtime";
import type { AutomaticBackupResult } from "@/types/backup-automation";

export async function runNativeAutomaticBackup(
  credential?: string,
): Promise<AutomaticBackupResult> {
  if (!hasTauriRuntime()) {
    throw new ApiError("O backup automático está disponível somente no aplicativo Desktop.", 400);
  }
  return invoke<AutomaticBackupResult>("run_automatic_backup", {
    credential: credential ?? null,
  });
}
