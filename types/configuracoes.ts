export type SettingsView =
  | "profile"
  | "preferences"
  | "notifications"
  | "security"
  | "activity"
  | "backups";

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
export type BackupStatus = "available" | "processing" | "failed";

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
  twoFactorEnabled: boolean;
  loginAlerts: boolean;
  sessionTimeoutMinutes: number;
  requirePasswordForExports: boolean;
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
};

export type BackupSnapshot = {
  id: string;
  fileName: string;
  createdAt: string;
  sizeBytes: number;
  modulesCount: number;
  status: BackupStatus;
  automatic: boolean;
};

export type PasswordChangeInput = {
  currentPassword: string;
  newPassword: string;
  confirmation: string;
};
