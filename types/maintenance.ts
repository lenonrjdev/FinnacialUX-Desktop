export type MaintenanceWindowDuration = 1 | 2 | 4;
export type MaintenanceJournalRetention = 5 | 10 | 20;
export type MaintenanceCheckStatus = "passed" | "attention" | "blocked";

export type MaintenancePreferences = {
  automaticMaintenance: boolean;
  maintenanceWeekday: 0 | 1 | 2 | 3 | 4 | 5 | 6;
  maintenanceStartHour: number;
  maintenanceWindowDuration: MaintenanceWindowDuration;
  installOnlyInsideWindow: boolean;
  requireVerifiedBackup: boolean;
  localTechnicalJournal: boolean;
  journalRetention: MaintenanceJournalRetention;
  deferredUpdatesUntil: string | null;
  lastMaintenanceAt: string | null;
};

export type LocalTechnicalError = {
  id: string;
  message: string;
  source: "react" | "window" | "promise";
  capturedAt: string;
  fingerprint: string;
};

export type MaintenanceSnapshot = {
  currentVersion: string;
  schemaVersion: number | null;
  updaterConfigured: boolean;
  backupBeforeInstall: boolean;
  latestBackupAt: string | null;
  latestDiagnosticAt: string | null;
  unresolvedTechnicalErrors: number;
  readOnly: boolean;
  now: string;
};

export type MaintenanceCheck = {
  id: string;
  title: string;
  detail: string;
  status: MaintenanceCheckStatus;
  required: boolean;
};

export type MaintenanceReport = {
  ready: boolean;
  score: number;
  passed: number;
  attention: number;
  blocked: number;
  nextWindowAt: string;
  deferred: boolean;
  checks: MaintenanceCheck[];
};
