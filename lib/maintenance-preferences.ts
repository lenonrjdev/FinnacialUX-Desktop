import { DEFAULT_MAINTENANCE_PREFERENCES } from "@/lib/maintenance-engine";
import type { LocalTechnicalError, MaintenancePreferences } from "@/types/maintenance";

const PREFERENCES_KEY = "finnacialux-maintenance-preferences-v1";
const JOURNAL_KEY = "finnacialux-local-technical-journal-v1";

function safeNumber(value: unknown, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function loadMaintenancePreferences(): MaintenancePreferences {
  if (typeof window === "undefined") return DEFAULT_MAINTENANCE_PREFERENCES;
  try {
    const parsed = JSON.parse(window.localStorage.getItem(PREFERENCES_KEY) ?? "{}") as Partial<MaintenancePreferences>;
    const weekday = safeNumber(parsed.maintenanceWeekday, DEFAULT_MAINTENANCE_PREFERENCES.maintenanceWeekday);
    const startHour = safeNumber(parsed.maintenanceStartHour, DEFAULT_MAINTENANCE_PREFERENCES.maintenanceStartHour);
    const duration = [1, 2, 4].includes(Number(parsed.maintenanceWindowDuration))
      ? Number(parsed.maintenanceWindowDuration) as MaintenancePreferences["maintenanceWindowDuration"]
      : DEFAULT_MAINTENANCE_PREFERENCES.maintenanceWindowDuration;
    const retention = [5, 10, 20].includes(Number(parsed.journalRetention))
      ? Number(parsed.journalRetention) as MaintenancePreferences["journalRetention"]
      : DEFAULT_MAINTENANCE_PREFERENCES.journalRetention;
    return {
      automaticMaintenance: parsed.automaticMaintenance !== false,
      maintenanceWeekday: Math.min(6, Math.max(0, weekday)) as MaintenancePreferences["maintenanceWeekday"],
      maintenanceStartHour: Math.min(23, Math.max(0, startHour)),
      maintenanceWindowDuration: duration,
      installOnlyInsideWindow: parsed.installOnlyInsideWindow === true,
      requireVerifiedBackup: parsed.requireVerifiedBackup !== false,
      localTechnicalJournal: parsed.localTechnicalJournal === true,
      journalRetention: retention,
      deferredUpdatesUntil: typeof parsed.deferredUpdatesUntil === "string" ? parsed.deferredUpdatesUntil : null,
      lastMaintenanceAt: typeof parsed.lastMaintenanceAt === "string" ? parsed.lastMaintenanceAt : null,
    };
  } catch {
    return DEFAULT_MAINTENANCE_PREFERENCES;
  }
}

export function saveMaintenancePreferences(preferences: MaintenancePreferences): MaintenancePreferences {
  if (typeof window !== "undefined") {
    window.localStorage.setItem(PREFERENCES_KEY, JSON.stringify(preferences));
    window.dispatchEvent(new CustomEvent("finnacialux-maintenance-preferences-change", { detail: preferences }));
  }
  return preferences;
}

function sanitizeMessage(value: string): string {
  return value
    .replace(/[A-Z]:\\[^\n\r]+/gi, "[CAMINHO_REMOVIDO]")
    .replace(/(?:[a-z0-9._%+-]+)@(?:[a-z0-9.-]+\.[a-z]{2,})/gi, "[EMAIL_REMOVIDO]")
    .replace(/(token|secret|password|senha|key)\s*[:=]\s*[^\s,;]+/gi, "$1=[SEGREDO_REMOVIDO]")
    .slice(0, 500);
}

function fingerprint(value: string): string {
  let hash = 2166136261;
  for (const char of value) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

export function listLocalTechnicalErrors(): LocalTechnicalError[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(JOURNAL_KEY) ?? "[]");
    return Array.isArray(parsed) ? parsed.filter((item) => item && typeof item.message === "string") : [];
  } catch {
    return [];
  }
}

export function recordLocalTechnicalError(
  message: string,
  source: LocalTechnicalError["source"] = "react",
): void {
  if (typeof window === "undefined") return;
  const preferences = loadMaintenancePreferences();
  if (!preferences.localTechnicalJournal) return;
  const sanitized = sanitizeMessage(message);
  const item: LocalTechnicalError = {
    id: crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    message: sanitized,
    source,
    capturedAt: new Date().toISOString(),
    fingerprint: fingerprint(sanitized),
  };
  const previous = listLocalTechnicalErrors().filter((entry) => entry.fingerprint !== item.fingerprint);
  const next = [item, ...previous].slice(0, preferences.journalRetention);
  window.localStorage.setItem(JOURNAL_KEY, JSON.stringify(next));
}

export function clearLocalTechnicalErrors(): void {
  if (typeof window !== "undefined") window.localStorage.removeItem(JOURNAL_KEY);
}

export function setMaintenanceUpdateDeferral(until: string | null): MaintenancePreferences {
  const next = { ...loadMaintenancePreferences(), deferredUpdatesUntil: until };
  return saveMaintenancePreferences(next);
}
