import type {
  ActiveSession,
  ActivityLogEntry,
  BackupSettings,
  BackupSnapshot,
  FinancialPreferences,
  NotificationSettings,
  ProfileSettings,
  SecuritySettings,
} from "@/types/configuracoes";

export const initialProfileSettings: ProfileSettings = {
  name: "",
  email: "",
  phone: "",
  timeZone: "America/Sao_Paulo",
};

export const initialFinancialPreferences: FinancialPreferences = {
  currency: "BRL",
  locale: "pt-BR",
  dateFormat: "dd/MM/yyyy",
  financialMonthStartDay: 1,
  defaultAccountId: "",
  appearance: "system",
  hideBalancesOnOpen: false,
  compactNumbers: false,
};

export const initialNotificationSettings: NotificationSettings = {
  billsDue: true,
  billsDueDaysBefore: 3,
  receivablesDue: true,
  budgetAlerts: true,
  budgetAlertPercent: 80,
  lowBalanceAlerts: true,
  lowBalanceAmount: 500,
  weeklySummary: true,
  monthlySummary: true,
  securityAlerts: true,
  emailChannel: true,
  browserChannel: true,
};

export const initialSecuritySettings: SecuritySettings = {
  twoFactorEnabled: false,
  loginAlerts: true,
  sessionTimeoutMinutes: 60,
  requirePasswordForExports: false,
};

export const initialActiveSessions: ActiveSession[] = [];
export const initialActivityLog: ActivityLogEntry[] = [];

export const initialBackupSettings: BackupSettings = {
  automaticEnabled: false,
  frequency: "weekly",
  retentionCount: 5,
  includeAttachments: false,
};

export const initialBackupSnapshots: BackupSnapshot[] = [];
