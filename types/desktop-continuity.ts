import type { IntegrityReport } from "@/types/desktop-protection";

export type DatabaseAccessStatus = {
  readOnly: boolean;
  reason: string | null;
  enteredAt: string | null;
};

export type ContinuityPreferences = {
  startupIntegrityCheck: boolean;
  createDailyRecoveryPoint: boolean;
  recoveryPointRetention: number;
  maximumAgeDays: number;
  enterReadOnlyOnFailure: boolean;
  lastStartupCheckAt: string | null;
  lastHealthyRecoveryPointAt: string | null;
};

export type RecoveryPoint = {
  id: string;
  fileName: string;
  filePath: string;
  reason: string;
  format: "fuxbackup" | "sqlcipher";
  status: "available" | "missing" | "failed";
  schemaVersion: number;
  sizeBytes: number;
  checksumSha256: string | null;
  createdAt: string;
  verifiedAt: string | null;
  appVersion: string;
  protected: boolean;
  errorMessage: string | null;
};

export type ContinuityEvent = {
  id: string;
  eventType: string;
  severity: "info" | "warning" | "critical";
  message: string;
  recoveryPointId: string | null;
  detailsJson: string | null;
  createdAt: string;
  appVersion: string;
};

export type ContinuityStatus = {
  access: DatabaseAccessStatus;
  integrity: IntegrityReport;
  preferences: ContinuityPreferences;
  recoveryPointsCount: number;
  lastRecoveryPointAt: string | null;
  latestEvent: ContinuityEvent | null;
};

export type ContinuityCheckResult = {
  healthy: boolean;
  readOnlyActivated: boolean;
  recoveryPointCreated: boolean;
  integrity: IntegrityReport;
  message: string;
};

export type RecoveryOperationResult = {
  restored: boolean;
  recoveryPointId: string;
  safetyBackupPath: string;
  message: string;
};
