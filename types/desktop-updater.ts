import type { Update } from "@tauri-apps/plugin-updater";

export type DesktopUpdaterPreferences = {
  automaticCheck: boolean;
  checkIntervalHours: 6 | 12 | 24 | 48 | 72;
  backupBeforeInstall: boolean;
  lastCheckedAt: string | null;
  skippedVersion: string | null;
};

export type DesktopUpdaterPublicConfig = {
  enabled: boolean;
  channel: "stable";
  repositoryUrl: string;
  endpoint: string;
  configuredAt: string | null;
};

export type DesktopUpdaterStatus = {
  currentVersion: string;
  configured: boolean;
  developmentBuild: boolean;
  channel: "stable";
  repositoryUrl: string;
  endpointHost: string;
  preferences: DesktopUpdaterPreferences;
};

export type DesktopUpdateCheckResult = {
  checked: boolean;
  reason: string;
  update: Update | null;
};

export type DesktopUpdateProgress = {
  phase: "idle" | "backup" | "downloading" | "installing" | "failed";
  downloadedBytes: number;
  totalBytes: number | null;
  percent: number;
  message: string;
};
