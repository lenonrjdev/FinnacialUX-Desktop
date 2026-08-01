import {
  defaultBackupAutomationPreferences,
  emptyBackupAutomationRuntimeState,
  normalizeBackupAutomationPreferences,
} from "@/lib/backup-automation-engine";
import type {
  BackupAutomationPreferences,
  BackupAutomationRuntimeState,
} from "@/types/backup-automation";

const preferencesKey = "finnacialux-backup-automation-v1";
const runtimeKey = "finnacialux-backup-automation-runtime-v1";

function parse<T>(key: string): Partial<T> | null {
  if (typeof window === "undefined") return null;
  try {
    return JSON.parse(window.localStorage.getItem(key) ?? "null") as Partial<T> | null;
  } catch {
    return null;
  }
}

export function loadBackupAutomationPreferences(): BackupAutomationPreferences {
  return normalizeBackupAutomationPreferences(parse<BackupAutomationPreferences>(preferencesKey));
}

export function saveBackupAutomationPreferences(
  preferences: BackupAutomationPreferences,
): BackupAutomationPreferences {
  const normalized = normalizeBackupAutomationPreferences(preferences);
  if (typeof window !== "undefined") {
    window.localStorage.setItem(preferencesKey, JSON.stringify(normalized));
    window.dispatchEvent(new CustomEvent("finnacialux-backup-automation-preferences-updated"));
  }
  return normalized;
}

export function loadBackupAutomationRuntimeState(): BackupAutomationRuntimeState {
  const stored = parse<BackupAutomationRuntimeState>(runtimeKey);
  if (!stored) return { ...emptyBackupAutomationRuntimeState };
  return {
    running: stored.running === true,
    lastCheckedAt: typeof stored.lastCheckedAt === "string" ? stored.lastCheckedAt : null,
    lastCreatedAt: typeof stored.lastCreatedAt === "string" ? stored.lastCreatedAt : null,
    lastStatus: stored.lastStatus === "created" || stored.lastStatus === "skipped" || stored.lastStatus === "failed"
      ? stored.lastStatus
      : null,
    lastReason: typeof stored.lastReason === "string" ? stored.lastReason : null,
    consecutiveFailures: Math.max(0, Number(stored.consecutiveFailures) || 0),
    history: Array.isArray(stored.history) ? stored.history.slice(0, 50) : [],
  };
}

export function saveBackupAutomationRuntimeState(
  state: BackupAutomationRuntimeState,
): BackupAutomationRuntimeState {
  if (typeof window !== "undefined") {
    window.localStorage.setItem(runtimeKey, JSON.stringify(state));
    window.dispatchEvent(new CustomEvent("finnacialux-backup-automation-updated", { detail: state }));
  }
  return state;
}

export function clearBackupAutomationHistory(): BackupAutomationRuntimeState {
  const current = loadBackupAutomationRuntimeState();
  return saveBackupAutomationRuntimeState({ ...current, history: [] });
}

export function resetBackupAutomationPreferences(): BackupAutomationPreferences {
  return saveBackupAutomationPreferences(defaultBackupAutomationPreferences);
}
