import { emptyExternalBackupRuntimeState } from "@/lib/external-backup-engine";
import type { ExternalBackupRuntimeState } from "@/types/external-backup";

const runtimeKey = "finnacialux-external-backup-runtime-v1";

export function loadExternalBackupRuntimeState(): ExternalBackupRuntimeState {
  if (typeof window === "undefined") return { ...emptyExternalBackupRuntimeState };
  try {
    const stored = JSON.parse(window.localStorage.getItem(runtimeKey) ?? "null") as Partial<ExternalBackupRuntimeState> | null;
    if (!stored) return { ...emptyExternalBackupRuntimeState };
    return {
      running: stored.running === true,
      lastCheckedAt: typeof stored.lastCheckedAt === "string" ? stored.lastCheckedAt : null,
      lastCopiedAt: typeof stored.lastCopiedAt === "string" ? stored.lastCopiedAt : null,
      lastStatus: ["copied", "skipped", "failed", "verified"].includes(String(stored.lastStatus))
        ? stored.lastStatus as ExternalBackupRuntimeState["lastStatus"]
        : null,
      lastReason: typeof stored.lastReason === "string" ? stored.lastReason : null,
      consecutiveFailures: Math.max(0, Number(stored.consecutiveFailures) || 0),
      history: Array.isArray(stored.history) ? stored.history.slice(0, 30) : [],
    };
  } catch {
    return { ...emptyExternalBackupRuntimeState };
  }
}

export function saveExternalBackupRuntimeState(state: ExternalBackupRuntimeState): ExternalBackupRuntimeState {
  if (typeof window !== "undefined") {
    window.localStorage.setItem(runtimeKey, JSON.stringify(state));
    window.dispatchEvent(new CustomEvent("finnacialux-external-backup-updated", { detail: state }));
  }
  return state;
}

export function clearExternalBackupHistory(): ExternalBackupRuntimeState {
  const state = loadExternalBackupRuntimeState();
  return saveExternalBackupRuntimeState({ ...state, history: [] });
}
