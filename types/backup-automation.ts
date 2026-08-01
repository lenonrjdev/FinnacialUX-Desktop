export type BackupAutomationCheckInterval = 30 | 60 | 180 | 360;
export type BackupAutomationHistoryRetention = 10 | 20 | 50;
export type BackupAutomationAttemptStatus = "created" | "skipped" | "failed";

export type BackupAutomationPreferences = {
  runOnStartup: boolean;
  runOnFocus: boolean;
  checkIntervalMinutes: BackupAutomationCheckInterval;
  notifyOnSuccess: boolean;
  notifyOnFailure: boolean;
  historyRetention: BackupAutomationHistoryRetention;
};

export type AutomaticBackupRecord = {
  id: string;
  fileName: string;
  createdAt: string;
  status: "available" | "processing" | "missing" | "failed";
  integrityStatus?: "ok" | "warning" | "failed";
  sizeBytes?: number;
};

export type AutomaticBackupResult = {
  created: boolean;
  reason: string;
  record: AutomaticBackupRecord | null;
};

export type BackupAutomationHistoryEntry = {
  id: string;
  checkedAt: string;
  status: BackupAutomationAttemptStatus;
  reason: string;
  backupId: string | null;
  fileName: string | null;
};

export type BackupAutomationRuntimeState = {
  running: boolean;
  lastCheckedAt: string | null;
  lastCreatedAt: string | null;
  lastStatus: BackupAutomationAttemptStatus | null;
  lastReason: string | null;
  consecutiveFailures: number;
  history: BackupAutomationHistoryEntry[];
};

export type BackupAutomationHealthStatus = "protected" | "attention" | "blocked";

export type BackupAutomationHealth = {
  status: BackupAutomationHealthStatus;
  score: number;
  title: string;
  detail: string;
  nextBackupAt: string | null;
  overdue: boolean;
};
