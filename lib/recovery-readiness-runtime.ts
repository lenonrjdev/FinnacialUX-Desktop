import {
  isRecoveryDrillDue,
  recordRecoveryDrillFailure,
  recordRecoveryDrillResult,
  selectRecoveryDrillCandidate,
} from "@/lib/recovery-readiness-engine";
import {
  loadRecoveryReadinessPreferences,
  loadRecoveryReadinessRuntimeState,
  saveRecoveryReadinessRuntimeState,
} from "@/lib/recovery-readiness-preferences";
import {
  inspectNativeBackup,
  listNativeBackups,
  previewNativeBackup,
} from "@/lib/desktop/protection";
import type { RecoveryDrillResult, RecoveryReadinessRuntimeState } from "@/types/recovery-readiness";

export async function executeRecoveryReadinessDrill(
  getDeviceCredential: () => Promise<string>,
  options: { force?: boolean } = {},
): Promise<RecoveryReadinessRuntimeState> {
  const preferences = loadRecoveryReadinessPreferences();
  const current = loadRecoveryReadinessRuntimeState();
  if (!preferences.enabled && !options.force) return current;
  if (!options.force && !isRecoveryDrillDue(current.lastTestedAt, preferences.intervalDays)) return current;
  saveRecoveryReadinessRuntimeState({ ...current, running: true });
  try {
    const records = await listNativeBackups();
    const candidate = selectRecoveryDrillCandidate(records);
    if (!candidate) throw new Error("Nenhuma cópia íntegra está disponível para o ensaio de recuperação.");
    const header = await inspectNativeBackup(candidate.filePath);
    if (header.manifest.encryptionMode === "password") {
      throw new Error("A cópia mais recente usa senha manual e precisa ser testada na tela de restauração.");
    }
    const credential = header.manifest.encryptionMode === "device" ? await getDeviceCredential() : undefined;
    const startedAt = Date.now();
    const preview = await previewNativeBackup(candidate.filePath, credential);
    const durationMs = Math.max(1, Date.now() - startedAt);
    const passed = preview.compatible
      && preview.integrity.ok
      && preview.integrity.requiredTablesPresent
      && preview.manifest.schemaVersion === 14;
    const result: RecoveryDrillResult = {
      status: passed ? "passed" : "failed",
      testedAt: new Date().toISOString(),
      backupId: candidate.id,
      fileName: candidate.fileName,
      createdAt: candidate.createdAt,
      schemaVersion: preview.manifest.schemaVersion,
      appVersion: preview.manifest.appVersion,
      modulesCount: preview.manifest.modulesCount,
      durationMs,
      reason: passed
        ? "A cópia foi aberta, descriptografada e validada sem alterar o banco atual."
        : preview.compatibilityMessage || "A cópia não passou em todos os contratos de recuperação.",
    };
    return saveRecoveryReadinessRuntimeState(recordRecoveryDrillResult(current, preferences, result));
  } catch (error) {
    const failed = recordRecoveryDrillFailure(current, preferences, error);
    saveRecoveryReadinessRuntimeState(failed);
    throw Object.assign(new Error(failed.lastReason ?? "O ensaio de recuperação falhou."), { runtimeState: failed });
  }
}
