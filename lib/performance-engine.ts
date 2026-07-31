import type {
  DatabasePerformanceHealth,
  PerformanceProgressEvent,
  TransactionBenchmarkResult,
  TransactionPageFilters,
} from "@/types/performance";

export const MIN_TRANSACTION_PAGE_SIZE = 25;
export const MAX_TRANSACTION_PAGE_SIZE = 250;
export const MIN_IMPORT_BATCH_SIZE = 100;
export const MAX_IMPORT_BATCH_SIZE = 2_000;
export const DEFAULT_QUERY_TARGET_MS = 250;

export function clampInteger(value: number, minimum: number, maximum: number): number {
  if (!Number.isFinite(value)) return minimum;
  return Math.min(maximum, Math.max(minimum, Math.round(value)));
}

export function normalizePageSize(value: number | undefined, fallback = 50): number {
  return clampInteger(value ?? fallback, MIN_TRANSACTION_PAGE_SIZE, MAX_TRANSACTION_PAGE_SIZE);
}

export function normalizeImportBatchSize(value: number | undefined, fallback = 500): number {
  return clampInteger(value ?? fallback, MIN_IMPORT_BATCH_SIZE, MAX_IMPORT_BATCH_SIZE);
}

export function normalizeTransactionFilters(filters: TransactionPageFilters): TransactionPageFilters {
  const page = clampInteger(filters.page || 1, 1, Number.MAX_SAFE_INTEGER);
  const search = filters.search?.trim().slice(0, 120) || undefined;
  const accountId = filters.accountId?.trim().slice(0, 120) || undefined;
  const category = filters.category?.trim().slice(0, 120) || undefined;

  return {
    ...filters,
    page,
    pageSize: normalizePageSize(filters.pageSize),
    search,
    accountId,
    category,
    type: filters.type === "all" ? undefined : filters.type,
    status: filters.status === "all" ? undefined : filters.status,
  };
}

export function buildBatchPlan(totalItems: number, requestedBatchSize?: number): Array<{ start: number; end: number }> {
  const total = clampInteger(totalItems, 0, Number.MAX_SAFE_INTEGER);
  const batchSize = normalizeImportBatchSize(requestedBatchSize);
  const batches: Array<{ start: number; end: number }> = [];
  for (let start = 0; start < total; start += batchSize) {
    batches.push({ start, end: Math.min(total, start + batchSize) });
  }
  return batches;
}

export function calculateReusablePercent(pageCount: number, freePages: number): number {
  if (!Number.isFinite(pageCount) || pageCount <= 0 || !Number.isFinite(freePages) || freePages <= 0) return 0;
  return Math.min(100, Math.max(0, Number(((freePages / pageCount) * 100).toFixed(2))));
}

export function operationPercent(current: number, total: number): number {
  if (!Number.isFinite(total) || total <= 0) return 0;
  return Math.min(100, Math.max(0, Math.round((Math.max(0, current) / total) * 100)));
}

export function normalizeProgressEvent(event: PerformanceProgressEvent): PerformanceProgressEvent {
  return {
    ...event,
    current: Math.max(0, Math.round(event.current)),
    total: Math.max(0, Math.round(event.total)),
    percent: operationPercent(event.current, event.total),
  };
}

export function summarizeBenchmark(
  totalItems: number,
  pageSize: number,
  firstPageMs: number,
  lastPageMs: number,
  targetMs = DEFAULT_QUERY_TARGET_MS,
  sourceChecksum = "",
): TransactionBenchmarkResult {
  const samples = [firstPageMs, lastPageMs].filter((value) => Number.isFinite(value) && value >= 0);
  const averagePageMs = samples.length
    ? Number((samples.reduce((sum, value) => sum + value, 0) / samples.length).toFixed(2))
    : 0;
  const normalizedTarget = clampInteger(targetMs, 50, 10_000);
  return {
    totalItems: Math.max(0, Math.round(totalItems)),
    pageSize: normalizePageSize(pageSize),
    firstPageMs: Number(Math.max(0, firstPageMs).toFixed(2)),
    lastPageMs: Number(Math.max(0, lastPageMs).toFixed(2)),
    averagePageMs,
    targetMs: normalizedTarget,
    withinTarget: averagePageMs <= normalizedTarget,
    sourceChecksum,
  };
}

export function databaseHealthLabel(health: DatabasePerformanceHealth): "healthy" | "attention" | "maintenance" {
  if (health.runningOperations > 0) return "attention";
  if (health.reusablePercent >= 20) return "maintenance";
  return "healthy";
}
