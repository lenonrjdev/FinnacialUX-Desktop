import type { BackupFrequency } from "@/types/configuracoes";

export type NativeBackupKind = "manual" | "automatic" | "pre_restore" | "pre_update" | "recovery_point";
export type NativeBackupStatus = "available" | "missing" | "failed";
export type NativeIntegrityStatus = "ok" | "warning" | "failed";
export type BackupEncryptionMode = "none" | "device" | "password";

export type NativeBackupRecord = {
  id: string;
  fileName: string;
  filePath: string;
  createdAt: string;
  sizeBytes: number;
  modulesCount: number;
  kind: NativeBackupKind;
  status: NativeBackupStatus;
  integrityStatus: NativeIntegrityStatus;
  checksumSha256: string | null;
  appVersion: string;
  schemaVersion: number;
  encryptionMode: BackupEncryptionMode;
  errorMessage: string | null;
};

export type BackupManifest = {
  format: string;
  formatVersion: number;
  appIdentifier: string;
  appVersion: string;
  schemaVersion: number;
  createdAt: string;
  kind: string;
  databaseFileName: string;
  databaseSizeBytes: number;
  databaseSha256: string;
  modulesCount: number;
  encryptionMode: BackupEncryptionMode;
  encryptionSaltB64: string | null;
  encryptionNonceB64: string | null;
  payloadSizeBytes: number;
  payloadSha256: string;
};

export type BackupHeader = {
  filePath: string;
  fileName: string;
  packageSizeBytes: number;
  manifest: BackupManifest;
  requiresCredential: boolean;
};

export type IntegrityReport = {
  ok: boolean;
  integrityMessages: string[];
  foreignKeyViolations: number;
  requiredTablesPresent: boolean;
  schemaVersion: number;
  checkedAt: string;
};

export type BackupPreview = {
  filePath: string;
  fileName: string;
  packageSizeBytes: number;
  manifest: BackupManifest;
  integrity: IntegrityReport;
  compatible: boolean;
  compatibilityMessage: string;
};

export type MigrationEntry = {
  version: number;
  description: string;
  appliedAt: string;
};

export type DiagnosticReport = {
  appName: string;
  appVersion: string;
  identifier: string;
  operatingSystem: string;
  architecture: string;
  databasePath: string;
  databaseExists: boolean;
  databaseSizeBytes: number;
  databaseEncrypted: boolean;
  databaseCipherVersion: string;
  databaseKeyFingerprint: string;
  databaseEncryptedAt: string | null;
  databaseLastKeyRotationAt: string | null;
  databaseMigratedFromPlaintext: boolean;
  databaseMigrationBackupPath: string | null;
  backupsDirectory: string;
  logsDirectory: string;
  availableDiskBytes: number;
  backupCount: number;
  lastBackupAt: string | null;
  previousUncleanShutdown: boolean;
  safeMode: boolean;
  integrity: IntegrityReport;
  migrations: MigrationEntry[];
  generatedAt: string;
};

export type NativeBackupPreferences = {
  automaticEnabled: boolean;
  frequency: BackupFrequency;
  retentionCount: number;
  includeAttachments: boolean;
  encryptionMode: Extract<BackupEncryptionMode, "device" | "none">;
  lastAutomaticAt: string | null;
};

export type AutomaticBackupResult = {
  created: boolean;
  reason: string;
  record: NativeBackupRecord | null;
};

export type RecoveryStatus = {
  previousUncleanShutdown: boolean;
  markerPath: string;
};

export type RestoreOperationResult = {
  restored: boolean;
  safetyBackupPath: string;
  restoredFrom: string;
  message: string;
};
