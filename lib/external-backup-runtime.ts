import {
  recordExternalBackupFailure,
  recordExternalBackupMirror,
  recordExternalBackupVerification,
  selectExternalBackupCandidate,
} from "@/lib/external-backup-engine";
import {
  loadExternalBackupRuntimeState,
  saveExternalBackupRuntimeState,
} from "@/lib/external-backup-preferences";
import {
  getExternalBackupDestinationStatus,
  getExternalBackupPreferences,
  mirrorBackupExternally,
  verifyExternalBackupDestination,
} from "@/lib/desktop/external-backup";
import { listNativeBackups } from "@/lib/desktop/protection";
import type { ExternalBackupRuntimeState } from "@/types/external-backup";

export async function executeExternalBackupCycle(options: { force?: boolean; verifyOnly?: boolean } = {}): Promise<ExternalBackupRuntimeState> {
  const current = loadExternalBackupRuntimeState();
  saveExternalBackupRuntimeState({ ...current, running: true });
  try {
    const preferences = await getExternalBackupPreferences();
    if (!preferences.enabled && !options.force) {
      return saveExternalBackupRuntimeState({ ...current, running: false, lastReason: "A redundância externa está desativada." });
    }
    const destination = await getExternalBackupDestinationStatus();
    if (!destination.available || !destination.writable) throw new Error(destination.reason);
    if (options.verifyOnly) {
      return saveExternalBackupRuntimeState(recordExternalBackupVerification(current, await verifyExternalBackupDestination()));
    }
    const candidate = selectExternalBackupCandidate(await listNativeBackups());
    if (!candidate) throw new Error("Nenhum backup local criptografado e íntegro está disponível para espelhamento.");
    const mirrored = await mirrorBackupExternally(candidate.filePath);
    const next = recordExternalBackupMirror(current, mirrored);
    if (preferences.verifyAfterCopy) {
      return saveExternalBackupRuntimeState(recordExternalBackupVerification(next, await verifyExternalBackupDestination()));
    }
    return saveExternalBackupRuntimeState(next);
  } catch (error) {
    const failed = recordExternalBackupFailure(current, error);
    saveExternalBackupRuntimeState(failed);
    throw Object.assign(new Error(failed.lastReason ?? "A redundância externa falhou."), { runtimeState: failed });
  }
}
