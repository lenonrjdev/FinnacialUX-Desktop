export type DiagnosticCategory =
  | "database"
  | "security"
  | "files"
  | "backups"
  | "continuity"
  | "scheduler"
  | "updates"
  | "privacy";

export type DiagnosticCheckStatus = "passed" | "attention" | "failed" | "skipped";
export type DiagnosticSuiteStatus = "healthy" | "attention" | "failed" | "cancelled";
export type DiagnosticRepairAction =
  | "optimize_database"
  | "release_stale_tasks"
  | "refresh_file_health"
  | "clear_old_logs";

export type ClientDiagnosticContext = {
  strongholdReady: boolean;
  backupKeyAvailable: boolean;
  databaseKeyAvailable: boolean;
  updaterConfigured: boolean;
  updaterEndpointHost: string;
  developmentBuild: boolean;
};

export type DiagnosticCheck = {
  code: string;
  category: DiagnosticCategory;
  status: DiagnosticCheckStatus;
  title: string;
  detail: string;
  repairAction: DiagnosticRepairAction | null;
  durationMs: number;
};

export type DiagnosticSuiteResult = {
  id: string;
  status: DiagnosticSuiteStatus;
  score: number;
  checksTotal: number;
  checksPassed: number;
  checksAttention: number;
  checksFailed: number;
  checks: DiagnosticCheck[];
  availableRepairs: DiagnosticRepairAction[];
  readOnly: boolean;
  persisted: boolean;
  startedAt: string;
  completedAt: string;
};

export type DiagnosticRunSummary = {
  id: string;
  runKind: "preview" | "full" | "integrity" | "restore_drill" | "support_export" | "repair";
  status: DiagnosticSuiteStatus | "running";
  score: number;
  checksTotal: number;
  checksPassed: number;
  checksAttention: number;
  checksFailed: number;
  startedAt: string;
  completedAt: string | null;
};

export type DiagnosticRepairRecord = {
  id: string;
  actionKind: DiagnosticRepairAction;
  status: "running" | "succeeded" | "failed" | "skipped";
  resultSummary: string;
  startedAt: string;
  completedAt: string | null;
};

export type ApplyDiagnosticRepairRequest = {
  workspaceId: string;
  actionKind: DiagnosticRepairAction;
  runId: string | null;
};

export type RunDiagnosticSuiteRequest = {
  includeReadWriteTest: boolean;
  includeRestoreDrill: boolean;
  clientContext: ClientDiagnosticContext;
};

export type SupportPackageResult = {
  filePath: string;
  fileName: string;
  payloadSha256: string;
  packageSizeBytes: number;
  checksCount: number;
  createdAt: string;
};

export type SupportPackageValidation = {
  valid: boolean;
  format: string;
  formatVersion: number;
  payloadSha256: string;
  checksCount: number;
  generatedAt: string;
  message: string;
};
