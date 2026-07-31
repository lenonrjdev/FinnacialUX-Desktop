export type BackgroundTaskKind =
  | "automation_scan"
  | "due_alerts"
  | "financial_risk"
  | "goals_budget"
  | "monthly_closing"
  | "backup_reminder"
  | "weekly_summary";

export type BackgroundTaskStatus =
  | "pending"
  | "running"
  | "succeeded"
  | "failed"
  | "cancelled"
  | "skipped";

export type BackgroundNotificationStatus = "pending" | "dispatched" | "sent" | "failed" | "dismissed";
export type BackgroundNotificationSeverity = "info" | "warning" | "critical";

export interface BackgroundTaskPreferences {
  workspaceId: string;
  enabled: boolean;
  paused: boolean;
  runOnStartup: boolean;
  intervalMinutes: number;
  nativeNotifications: boolean;
  quietHoursEnabled: boolean;
  quietHoursStart: string;
  quietHoursEnd: string;
  automationScanEnabled: boolean;
  dueAlertsEnabled: boolean;
  financialRiskEnabled: boolean;
  goalsBudgetEnabled: boolean;
  monthlyClosingEnabled: boolean;
  backupReminderEnabled: boolean;
  weeklySummaryEnabled: boolean;
  retryLimit: number;
  lastSchedulerTickAt: string | null;
  lastSuccessfulRunAt: string | null;
  updatedAt: string;
}

export type SaveBackgroundTaskPreferences = Omit<
  BackgroundTaskPreferences,
  "workspaceId" | "lastSchedulerTickAt" | "lastSuccessfulRunAt" | "updatedAt"
>;

export interface BackgroundTask {
  id: string;
  workspaceId: string;
  taskKind: BackgroundTaskKind;
  dedupKey: string;
  scheduledFor: string;
  nextAttemptAt: string;
  status: BackgroundTaskStatus;
  priority: number;
  attempts: number;
  maxAttempts: number;
  startedAt: string | null;
  completedAt: string | null;
  resultSummary: string | null;
  errorCode: string | null;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface BackgroundTaskRun {
  id: string;
  workspaceId: string;
  taskId: string;
  taskKind: BackgroundTaskKind;
  attemptNumber: number;
  status: Exclude<BackgroundTaskStatus, "pending" | "running">;
  durationMs: number;
  resultSummary: string | null;
  errorCode: string | null;
  errorMessage: string | null;
  startedAt: string;
  completedAt: string;
}

export interface BackgroundNotification {
  id: string;
  workspaceId: string;
  taskId: string | null;
  kind: string;
  fingerprint: string;
  title: string;
  body: string;
  severity: BackgroundNotificationSeverity;
  status: BackgroundNotificationStatus;
  scheduledFor: string;
  dispatchedAt: string | null;
  sentAt: string | null;
  failureReason: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface BackgroundSchedulerStatus {
  workspaceId: string;
  active: boolean;
  enabled: boolean;
  paused: boolean;
  readOnlyBlocked: boolean;
  running: boolean;
  intervalMinutes: number;
  pendingTasks: number;
  failedTasks: number;
  pendingNotifications: number;
  lastSchedulerTickAt: string | null;
  lastSuccessfulRunAt: string | null;
  nextTickAt: string | null;
}

export interface BackgroundRunResult {
  status: BackgroundSchedulerStatus;
  queued: number;
  processed: number;
  succeeded: number;
  failed: number;
  skipped: number;
  notifications: BackgroundNotification[];
}

export interface BackgroundNotificationEvent {
  notification: BackgroundNotification;
}
