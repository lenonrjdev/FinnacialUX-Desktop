import { getVersion } from "@tauri-apps/api/app";
import { disable, enable, isEnabled } from "@tauri-apps/plugin-autostart";
import {
  isPermissionGranted,
  requestPermission,
  sendNotification,
} from "@tauri-apps/plugin-notification";
import { saveWindowState, StateFlags } from "@tauri-apps/plugin-window-state";
import { getDesktopDiagnostics } from "@/lib/desktop/protection";
import { hasTauriRuntime } from "@/lib/desktop/runtime";
import type {
  DesktopExperiencePreferences,
  DesktopPerformanceSnapshot,
  DesktopTextScale,
} from "@/types/desktop-experience";

const STORAGE_KEY = "finnacialux-desktop-experience-v1";

export const defaultDesktopExperiencePreferences: DesktopExperiencePreferences = {
  closeToTray: false,
  startWithWindows: false,
  nativeNotifications: false,
  reduceMotion: false,
  highContrast: false,
  textScale: 100,
  enhancedFocus: true,
  compactInterface: false,
};

function normalizeTextScale(value: unknown): DesktopTextScale {
  return [90, 100, 110, 120].includes(Number(value))
    ? Number(value) as DesktopTextScale
    : 100;
}

export function loadDesktopExperiencePreferences(): DesktopExperiencePreferences {
  if (typeof window === "undefined") return defaultDesktopExperiencePreferences;
  try {
    const stored = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "{}") as Partial<DesktopExperiencePreferences>;
    return {
      closeToTray: stored.closeToTray === true,
      startWithWindows: stored.startWithWindows === true,
      nativeNotifications: stored.nativeNotifications === true,
      reduceMotion: stored.reduceMotion === true,
      highContrast: stored.highContrast === true,
      textScale: normalizeTextScale(stored.textScale),
      enhancedFocus: stored.enhancedFocus !== false,
      compactInterface: stored.compactInterface === true,
    };
  } catch {
    return defaultDesktopExperiencePreferences;
  }
}

export function applyDesktopExperiencePreferences(preferences: DesktopExperiencePreferences) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.dataset.reduceMotion = preferences.reduceMotion ? "true" : "false";
  root.dataset.highContrast = preferences.highContrast ? "true" : "false";
  root.dataset.enhancedFocus = preferences.enhancedFocus ? "true" : "false";
  root.dataset.compactInterface = preferences.compactInterface ? "true" : "false";
  root.style.setProperty("--desktop-text-scale", String(preferences.textScale / 100));
}

export function saveDesktopExperiencePreferences(
  preferences: DesktopExperiencePreferences,
): DesktopExperiencePreferences {
  if (typeof window !== "undefined") {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
    window.dispatchEvent(new CustomEvent("finnacialux-experience-change", { detail: preferences }));
  }
  applyDesktopExperiencePreferences(preferences);
  return preferences;
}

export function isDesktopDevelopmentRuntime(): boolean {
  if (typeof window === "undefined") return false;
  return window.location.protocol === "http:" || window.location.protocol === "https:";
}

export async function getNativeAutostartState(): Promise<boolean> {
  if (!hasTauriRuntime()) return false;
  return isEnabled();
}

export async function setNativeAutostartState(enabled: boolean): Promise<boolean> {
  if (!hasTauriRuntime()) return false;
  if (isDesktopDevelopmentRuntime()) {
    throw new Error("A inicialização com o Windows só pode ser alterada pelo aplicativo instalado.");
  }
  if (enabled) await enable();
  else await disable();
  return isEnabled();
}

export async function ensureNativeNotificationPermission(): Promise<boolean> {
  if (!hasTauriRuntime()) return false;
  if (await isPermissionGranted()) return true;
  return (await requestPermission()) === "granted";
}

export async function sendNativeNotification(title: string, body: string): Promise<boolean> {
  if (!hasTauriRuntime()) return false;
  if (!(await ensureNativeNotificationPermission())) return false;
  sendNotification({ title, body });
  return true;
}

export async function saveDesktopWindowState(): Promise<void> {
  if (!hasTauriRuntime()) return;
  await saveWindowState(StateFlags.ALL);
}

function roundedMetric(value: number | undefined): number | null {
  return Number.isFinite(value) ? Math.round(value as number) : null;
}

export async function measureDesktopPerformance(): Promise<DesktopPerformanceSnapshot> {
  const navigation = typeof performance !== "undefined"
    ? performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined
    : undefined;
  const paints = typeof performance !== "undefined"
    ? performance.getEntriesByType("paint")
    : [];
  const firstPaint = paints.find((entry) => entry.name === "first-paint");
  const firstContentfulPaint = paints.find((entry) => entry.name === "first-contentful-paint");
  const diagnosticsStartedAt = typeof performance !== "undefined" ? performance.now() : 0;

  let diagnosticsLatencyMs: number | null = null;
  let databaseSizeBytes: number | null = null;
  let backupCount: number | null = null;
  let availableDiskBytes: number | null = null;
  let schemaVersion: number | null = null;
  let databaseEncrypted: boolean | null = null;

  if (hasTauriRuntime()) {
    try {
      const diagnostics = await getDesktopDiagnostics();
      diagnosticsLatencyMs = roundedMetric(performance.now() - diagnosticsStartedAt);
      databaseSizeBytes = diagnostics.databaseSizeBytes;
      backupCount = diagnostics.backupCount;
      availableDiskBytes = diagnostics.availableDiskBytes;
      schemaVersion = diagnostics.integrity.schemaVersion;
      databaseEncrypted = diagnostics.databaseEncrypted;
    } catch {
      diagnosticsLatencyMs = null;
    }
  }

  return {
    appVersion: hasTauriRuntime() ? await getVersion().catch(() => "0.6.0") : "0.6.0",
    measuredAt: new Date().toISOString(),
    domReadyMs: roundedMetric(navigation?.domContentLoadedEventEnd),
    firstPaintMs: roundedMetric(firstPaint?.startTime),
    firstContentfulPaintMs: roundedMetric(firstContentfulPaint?.startTime),
    diagnosticsLatencyMs,
    databaseSizeBytes,
    backupCount,
    availableDiskBytes,
    schemaVersion,
    databaseEncrypted,
  };
}
