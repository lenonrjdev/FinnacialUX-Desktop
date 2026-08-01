import type { NativeBackupRecord } from "@/types/desktop-protection";

export type ExternalBackupRetention = 3 | 5 | 10 | 20;
export type ExternalBackupDestinationKind =
  | "unconfigured"
  | "disconnected"
  | "local-backup-directory"
  | "synchronized-folder"
  | "secondary-volume"
  | "same-volume";

export type ExternalBackupPreferences = {
  enabled: boolean;
  destinationDirectory: string | null;
  mirrorOnStartup: boolean;
  mirrorOnFocus: boolean;
  mirrorAfterBackup: boolean;
  retentionCount: ExternalBackupRetention;
  verifyAfterCopy: boolean;
  notifyOnSuccess: boolean;
  notifyOnFailure: boolean;
  lastMirroredAt: string | null;
  lastVerifiedAt: string | null;
};

export type ExternalBackupDestinationStatus = {
  configured: boolean;
  available: boolean;
  writable: boolean;
  independent: boolean;
  destinationDirectory: string | null;
  managedDirectory: string | null;
  destinationKind: ExternalBackupDestinationKind;
  reason: string;
  checkedAt: string;
};

export type ExternalBackupCopy = {
  fileName: string;
  filePath: string;
  sizeBytes: number;
  checksumSha256: string;
  createdAt: string;
  valid: boolean;
  verificationReason: string;
};

export type ExternalBackupVerification = {
  status: ExternalBackupDestinationStatus;
  copies: ExternalBackupCopy[];
  validCount: number;
  invalidCount: number;
  latestCopyAt: string | null;
  checkedAt: string;
  reason: string;
};

export type ExternalBackupMirrorResult = {
  copied: boolean;
  reason: string;
  sourceFileName: string;
  copy: ExternalBackupCopy | null;
  removedCount: number;
  status: ExternalBackupDestinationStatus;
};

export type ExternalBackupHistoryStatus = "copied" | "skipped" | "failed" | "verified";

export type ExternalBackupHistoryEntry = {
  id: string;
  checkedAt: string;
  status: ExternalBackupHistoryStatus;
  reason: string;
  fileName: string | null;
};

export type ExternalBackupRuntimeState = {
  running: boolean;
  lastCheckedAt: string | null;
  lastCopiedAt: string | null;
  lastStatus: ExternalBackupHistoryStatus | null;
  lastReason: string | null;
  consecutiveFailures: number;
  history: ExternalBackupHistoryEntry[];
};

export type ExternalBackupHealthStatus = "protected" | "attention" | "blocked";

export type ExternalBackupHealth = {
  status: ExternalBackupHealthStatus;
  score: number;
  title: string;
  detail: string;
  latestCopyAt: string | null;
};

export type ExternalBackupCandidate = Pick<NativeBackupRecord,
  "id" | "fileName" | "filePath" | "createdAt" | "encryptionMode" | "status" | "integrityStatus" | "kind"
>;
