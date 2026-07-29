export type DesktopTextScale = 90 | 100 | 110 | 120;

export type DesktopExperiencePreferences = {
  closeToTray: boolean;
  startWithWindows: boolean;
  nativeNotifications: boolean;
  reduceMotion: boolean;
  highContrast: boolean;
  textScale: DesktopTextScale;
  enhancedFocus: boolean;
  compactInterface: boolean;
};

export type DesktopPerformanceSnapshot = {
  appVersion: string;
  measuredAt: string;
  domReadyMs: number | null;
  firstPaintMs: number | null;
  firstContentfulPaintMs: number | null;
  diagnosticsLatencyMs: number | null;
  databaseSizeBytes: number | null;
  backupCount: number | null;
  availableDiskBytes: number | null;
  schemaVersion: number | null;
  databaseEncrypted: boolean | null;
};

export type DesktopExperienceNotice = {
  kind: "success" | "warning" | "error" | "info";
  message: string;
};
