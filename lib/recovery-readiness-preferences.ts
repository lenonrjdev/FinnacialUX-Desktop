import {
  defaultRecoveryReadinessPreferences,
  emptyRecoveryReadinessRuntimeState,
  normalizeRecoveryReadinessPreferences,
} from "@/lib/recovery-readiness-engine";
import type {
  RecoveryReadinessPreferences,
  RecoveryReadinessRuntimeState,
} from "@/types/recovery-readiness";

const preferencesKey = "finnacialux-recovery-readiness-v1";
const runtimeKey = "finnacialux-recovery-readiness-runtime-v1";

function parse<T>(key: string): Partial<T> | null {
  if (typeof window === "undefined") return null;
  try {
    return JSON.parse(window.localStorage.getItem(key) ?? "null") as Partial<T> | null;
  } catch {
    return null;
  }
}

export function loadRecoveryReadinessPreferences(): RecoveryReadinessPreferences {
  return normalizeRecoveryReadinessPreferences(parse<RecoveryReadinessPreferences>(preferencesKey));
}

export function saveRecoveryReadinessPreferences(
  preferences: RecoveryReadinessPreferences,
): RecoveryReadinessPreferences {
  const normalized = normalizeRecoveryReadinessPreferences(preferences);
  if (typeof window !== "undefined") {
    window.localStorage.setItem(preferencesKey, JSON.stringify(normalized));
    window.dispatchEvent(new CustomEvent("finnacialux-recovery-readiness-preferences-updated"));
  }
  return normalized;
}

export function loadRecoveryReadinessRuntimeState(): RecoveryReadinessRuntimeState {
  const stored = parse<RecoveryReadinessRuntimeState>(runtimeKey);
  if (!stored) return { ...emptyRecoveryReadinessRuntimeState };
  return {
    running: stored.running === true,
    lastTestedAt: typeof stored.lastTestedAt === "string" ? stored.lastTestedAt : null,
    lastPassedAt: typeof stored.lastPassedAt === "string" ? stored.lastPassedAt : null,
    lastStatus: stored.lastStatus === "passed" || stored.lastStatus === "attention" || stored.lastStatus === "failed" ? stored.lastStatus : null,
    lastReason: typeof stored.lastReason === "string" ? stored.lastReason : null,
    lastDurationMs: Number.isFinite(Number(stored.lastDurationMs)) ? Math.max(0, Number(stored.lastDurationMs)) : null,
    lastBackupId: typeof stored.lastBackupId === "string" ? stored.lastBackupId : null,
    consecutiveFailures: Math.max(0, Number(stored.consecutiveFailures) || 0),
    history: Array.isArray(stored.history) ? stored.history.slice(0, 50) : [],
  };
}

export function saveRecoveryReadinessRuntimeState(
  state: RecoveryReadinessRuntimeState,
): RecoveryReadinessRuntimeState {
  if (typeof window !== "undefined") {
    window.localStorage.setItem(runtimeKey, JSON.stringify(state));
    window.dispatchEvent(new CustomEvent("finnacialux-recovery-readiness-updated", { detail: state }));
  }
  return state;
}

export function clearRecoveryReadinessHistory(): RecoveryReadinessRuntimeState {
  const current = loadRecoveryReadinessRuntimeState();
  return saveRecoveryReadinessRuntimeState({ ...current, history: [] });
}

export function resetRecoveryReadinessPreferences(): RecoveryReadinessPreferences {
  return saveRecoveryReadinessPreferences(defaultRecoveryReadinessPreferences);
}
