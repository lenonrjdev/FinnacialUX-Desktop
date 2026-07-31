export type SettingsView =
  | "profile"
  | "preferences"
  | "notifications"
  | "security"
  | "activity"
  | "backups"
  | "continuity"
  | "diagnostics"
  | "performance"
  | "background"
  | "desktop"
  | "accessibility"
  | "onboarding"
  | "updates";

export type AppearanceMode = "light" | "dark" | "system";
export type DateFormat = "dd/MM/yyyy" | "MM/dd/yyyy" | "yyyy-MM-dd";
export type BackupFrequency = "daily" | "weekly" | "monthly";
export type ActivityType =
  | "login"
  | "security"
  | "profile"
  | "workspace"
  | "data"
  | "backup";
export type ActivityStatus = "success" | "attention" | "blocked";
export type SessionDeviceType = "desktop" | "mobile" | "tablet";
export type BackupStatus = "available" | "processing" | "missing" | "failed";

export type ProfileSettings = {
  name: string;
  email: string;
  phone: string;
  timeZone: string;
};

export type FinancialPreferences = {
  currency: "BRL";
  locale: "pt-BR";
  dateFormat: DateFormat;
  financialMonthStartDay: number;
  defaultAccountId: string;
  appearance: AppearanceMode;
  hideBalancesOnOpen: boolean;
  compactNumbers: boolean;
};

export type NotificationSettings = {
  billsDue: boolean;
  billsDueDaysBefore: number;
  receivablesDue: boolean;
  budgetAlerts: boolean;
  budgetAlertPercent: number;
  lowBalanceAlerts: boolean;
  lowBalanceAmount: number;
  weeklySummary: boolean;
  monthlySummary: boolean;
  securityAlerts: boolean;
  emailChannel: boolean;
  browserChannel: boolean;
};

export type SecuritySettings = {
  pinEnabled: boolean;
  autoLockMinutes: 0 | 5 | 15 | 30 | 60 | 120;
  lockOnMinimize: boolean;
  requirePasswordForExports: boolean;
  requirePasswordForRestore: boolean;
  encryptedBackupsDefault: boolean;
  vaultInitialized: boolean;
};

export type ActiveSession = {
  id: string;
  deviceName: string;
  deviceType: SessionDeviceType;
  browser: string;
  location: string;
  ipAddress: string;
  lastActiveAt: string;
  current: boolean;
};

export type ActivityLogEntry = {
  id: string;
  type: ActivityType;
  title: string;
  description: string;
  actor: string;
  occurredAt: string;
  device: string;
  status: ActivityStatus;
};

export type BackupSettings = {
  automaticEnabled: boolean;
  frequency: BackupFrequency;
  retentionCount: number;
  includeAttachments: boolean;
  encryptionMode: "device" | "none";
  lastAutomaticAt?: string | null;
};

export type BackupSnapshot = {
  id: string;
  fileName: string;
  createdAt: string;
  sizeBytes: number;
  modulesCount: number;
  status: BackupStatus;
  automatic: boolean;
  kind?: "manual" | "automatic" | "pre_restore" | "pre_update" | "recovery_point";
  filePath?: string;
  integrityStatus?: "ok" | "warning" | "failed";
  checksumSha256?: string | null;
  appVersion?: string;
  schemaVersion?: number;
  errorMessage?: string | null;
  encryptionMode?: "none" | "device" | "password";
};

export type PasswordChangeInput = {
  currentPassword: string;
  newPassword: string;
  confirmation: string;
};
