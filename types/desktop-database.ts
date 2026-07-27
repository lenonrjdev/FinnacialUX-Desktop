export type DatabaseEncryptionStatus = {
  opened: boolean;
  encrypted: boolean;
  cipherVersion: string;
  schemaVersion: number;
  keyFingerprint: string;
  databasePath: string;
  databaseSizeBytes: number;
  encryptedAt: string | null;
  lastKeyRotationAt: string | null;
  migratedFromPlaintext: boolean;
  migrationBackupPath: string | null;
};

export type DatabaseExecuteResult = {
  rowsAffected: number;
  lastInsertId: number;
};

export type DatabaseKeyCandidate = {
  source: "active" | "pending" | "previous";
  value: string;
};
