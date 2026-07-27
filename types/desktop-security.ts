export type LocalSecuritySettings = {
  pinEnabled: boolean;
  autoLockMinutes: 0 | 5 | 15 | 30 | 60 | 120;
  lockOnMinimize: boolean;
  requirePasswordForExports: boolean;
  requirePasswordForRestore: boolean;
  encryptedBackupsDefault: boolean;
  failedPinAttempts: number;
  pinLockedUntil: string | null;
  lastLockedAt: string | null;
  vaultInitialized: boolean;
};

export type PinVerificationResult = {
  valid: boolean;
  locked: boolean;
  remainingAttempts: number;
  lockedUntil: string | null;
  message: string;
};

export type SecurityEventRecord = {
  id: string;
  eventType: string;
  severity: "info" | "warning" | "error";
  message: string;
  createdAt: string;
};

export type Argon2Credential = {
  hash: string;
  algorithm: "argon2id";
};

export type SensitiveAction = "export" | "restore" | "security";
