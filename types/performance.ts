import type { FinancialTransaction, TransactionStatus, TransactionType } from "@/types/lancamentos";

export type PerformanceOperationKind =
  | "transaction_index"
  | "reconciliation_import"
  | "database_maintenance"
  | "benchmark";

export type PerformanceOperationStatus = "queued" | "running" | "completed" | "cancelled" | "failed";

export type PerformancePreferences = {
  workspaceId: string;
  transactionPageSize: number;
  importBatchSize: number;
  queryTimeoutMs: number;
  autoAnalyze: boolean;
  lastAnalyzeAt?: string | null;
  updatedAt: string;
};

export type SavePerformancePreferencesRequest = Omit<
  PerformancePreferences,
  "workspaceId" | "lastAnalyzeAt" | "updatedAt"
>;

export type TransactionPageFilters = {
  page: number;
  pageSize?: number;
  search?: string;
  dateFrom?: string;
  dateTo?: string;
  type?: TransactionType | "all";
  status?: TransactionStatus | "all";
  accountId?: string;
  category?: string;
};

export type TransactionPage = {
  items: FinancialTransaction[];
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  sourceChecksum: string;
  indexRebuilt: boolean;
  durationMs: number;
};

export type PerformanceOperation = {
  id: string;
  workspaceId: string;
  kind: PerformanceOperationKind;
  status: PerformanceOperationStatus;
  progressCurrent: number;
  progressTotal: number;
  cancellationRequested: boolean;
  details: Record<string, unknown>;
  errorMessage?: string | null;
  startedAt?: string | null;
  completedAt?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type PerformanceProgressEvent = {
  operationId: string;
  kind: PerformanceOperationKind;
  status: PerformanceOperationStatus;
  current: number;
  total: number;
  percent: number;
  message: string;
};

export type PerformanceMetric = {
  id: string;
  workspaceId: string;
  operationType: PerformanceOperationKind | string;
  itemCount: number;
  durationMs: number;
  status: "success" | "cancelled" | "failed";
  cancelled: boolean;
  details: Record<string, unknown>;
  createdAt: string;
};

export type DatabasePerformanceHealth = {
  schemaVersion: number;
  pageCount: number;
  freePages: number;
  pageSizeBytes: number;
  databaseSizeBytes: number;
  reusableBytes: number;
  reusablePercent: number;
  journalMode: string;
  transactionIndexRows: number;
  indexedWorkspaces: number;
  metricsCount: number;
  runningOperations: number;
  lastAnalyzeAt?: string | null;
};

export type MaintenanceResult = {
  analyzed: boolean;
  optimized: boolean;
  checkpointed: boolean;
  durationMs: number;
  health: DatabasePerformanceHealth;
};

export type TransactionBenchmarkResult = {
  totalItems: number;
  firstPageMs: number;
  lastPageMs: number;
  averagePageMs: number;
  pageSize: number;
  targetMs: number;
  withinTarget: boolean;
  sourceChecksum: string;
};
