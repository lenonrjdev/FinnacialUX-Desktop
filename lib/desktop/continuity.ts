import { invoke } from "@tauri-apps/api/core";
import { ApiError } from "@/lib/api/client";
import { getDesktopDatabase, isDesktopRuntime } from "@/lib/desktop/database";
import type {
  ContinuityCheckResult,
  ContinuityPreferences,
  ContinuityStatus,
  DatabaseAccessStatus,
  RecoveryOperationResult,
  RecoveryPoint,
} from "@/types/desktop-continuity";

async function ensureReady() {
  if (!isDesktopRuntime()) throw new ApiError("A continuidade local está disponível no aplicativo Desktop.", 400);
  await getDesktopDatabase();
}

export async function getContinuityStatus(): Promise<ContinuityStatus> {
  await ensureReady();
  return invoke<ContinuityStatus>("continuity_get_status");
}

export async function getDatabaseAccessStatus(): Promise<DatabaseAccessStatus> {
  await ensureReady();
  return invoke<DatabaseAccessStatus>("database_access_status");
}

export async function getContinuityPreferences(): Promise<ContinuityPreferences> {
  await ensureReady();
  return invoke<ContinuityPreferences>("continuity_get_preferences");
}

export async function saveContinuityPreferences(
  preferences: ContinuityPreferences,
): Promise<ContinuityPreferences> {
  await ensureReady();
  return invoke<ContinuityPreferences>("continuity_save_preferences", { preferences });
}

export async function listRecoveryPoints(): Promise<RecoveryPoint[]> {
  await ensureReady();
  return invoke<RecoveryPoint[]>("continuity_list_recovery_points");
}

export async function createRecoveryPoint(
  credential?: string,
  protectedPoint = false,
): Promise<RecoveryPoint> {
  await ensureReady();
  return invoke<RecoveryPoint>("continuity_create_recovery_point", {
    credential,
    protected: protectedPoint,
  });
}

export async function verifyRecoveryPoint(
  recoveryPointId: string,
  credential?: string,
): Promise<RecoveryPoint> {
  await ensureReady();
  return invoke<RecoveryPoint>("continuity_verify_recovery_point", { recoveryPointId, credential });
}

export async function restoreRecoveryPoint(
  recoveryPointId: string,
  credential?: string,
  safetyCredential?: string,
): Promise<RecoveryOperationResult> {
  await ensureReady();
  return invoke<RecoveryOperationResult>("continuity_restore_recovery_point", {
    recoveryPointId,
    credential,
    safetyCredential,
  });
}

export async function runStartupContinuityCheck(
  credential?: string,
): Promise<ContinuityCheckResult> {
  await ensureReady();
  return invoke<ContinuityCheckResult>("continuity_run_startup_check", { credential });
}

export async function exitNativeReadOnlyMode(): Promise<DatabaseAccessStatus> {
  await ensureReady();
  return invoke<DatabaseAccessStatus>("continuity_exit_read_only");
}
