import {
  recordBackupAutomationFailure,
  recordBackupAutomationResult,
} from "@/lib/backup-automation-engine";
import {
  loadBackupAutomationPreferences,
  loadBackupAutomationRuntimeState,
  saveBackupAutomationRuntimeState,
} from "@/lib/backup-automation-preferences";
import { runNativeAutomaticBackup } from "@/lib/desktop/backup-automation";
import { getNativeBackupPreferences } from "@/lib/desktop/protection";
import type { BackupAutomationRuntimeState } from "@/types/backup-automation";

export async function executeBackupAutomationCycle(
  getDeviceCredential: () => Promise<string>,
): Promise<BackupAutomationRuntimeState> {
  const preferences = loadBackupAutomationPreferences();
  const current = loadBackupAutomationRuntimeState();
  saveBackupAutomationRuntimeState({ ...current, running: true });
  try {
    const nativePreferences = await getNativeBackupPreferences();
    const credential = nativePreferences.automaticEnabled && nativePreferences.encryptionMode === "device"
      ? await getDeviceCredential()
      : undefined;
    const result = await runNativeAutomaticBackup(credential);
    return saveBackupAutomationRuntimeState(
      recordBackupAutomationResult(current, preferences, result),
    );
  } catch (error) {
    const failed = recordBackupAutomationFailure(current, preferences, error);
    saveBackupAutomationRuntimeState(failed);
    throw Object.assign(new Error(failed.lastReason ?? "O backup automático falhou."), { runtimeState: failed });
  }
}
