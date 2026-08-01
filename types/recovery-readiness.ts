import type { BackupEncryptionMode, NativeBackupKind } from "@/types/desktop-protection";

export type RecoveryDrillIntervalDays = 7 | 14 | 30;
export type RecoveryDrillHistoryRetention = 10 | 20 | 50;
export type RecoveryDrillStatus = "passed" | "attention" | "failed";

export type RecoveryReadinessPreferences = {
  enabled: boolean;
  runOnStartup: boolean;
  runOnFocus: boolean;
  intervalDays: RecoveryDrillIntervalDays;
  maximumBackupAgeDays: 1 | 3 | 7 | 14;
  requireTwoBackups: boolean;
  notifyOnSuccess: boolean;
  notifyOnFailure: boolean;
  historyRetention: RecoveryDrillHistoryRetention;
};

export type RecoveryDrillCandidate = {
  id: string;
  fileName: string;
  filePath: string;
  createdAt: string;
  sizeBytes: number;
  kind: NativeBackupKind;
  status: "available" | "processing" | "missing" | "failed";
  integrityStatus: "ok" | "warning" | "failed";
  schemaVersion: number;
  appVersion: string;
  encryptionMode: BackupEncryptionMode;
};

export type RecoveryDrillResult = {
  status: RecoveryDrillStatus;
  testedAt: string;
  backupId: string;
  fileName: string;
  createdAt: string;
  schemaVersion: number;
  appVersion: string;
  modulesCount: number;
  durationMs: number;
  reason: string;
};

export type RecoveryDrillHistoryEntry = RecoveryDrillResult & { id: string };

export type RecoveryReadinessRuntimeState = {
  running: boolean;
  lastTestedAt: string | null;
  lastPassedAt: string | null;
  lastStatus: RecoveryDrillStatus | null;
  lastReason: string | null;
  lastDurationMs: number | null;
  lastBackupId: string | null;
  consecutiveFailures: number;
  history: RecoveryDrillHistoryEntry[];
};

export type RecoveryReadinessCheck = {
  id: string;
  title: string;
  detail: string;
  status: "passed" | "attention" | "blocked";
  required: boolean;
};

export type RecoveryReadinessReport = {
  ready: boolean;
  status: "ready" | "attention" | "blocked";
  score: number;
  rpoHours: number | null;
  rtoMinutes: number | null;
  nextDrillAt: string | null;
  checks: RecoveryReadinessCheck[];
  plan: string[];
};
