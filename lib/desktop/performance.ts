import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { ApiError } from "@/lib/api/client";
import { isSafeModeEnabled } from "@/lib/desktop/protection";
import { hasTauriRuntime } from "@/lib/desktop/runtime";
import { normalizeProgressEvent, normalizeTransactionFilters } from "@/lib/performance-engine";
import type {
  DatabasePerformanceHealth,
  MaintenanceResult,
  PerformanceMetric,
  PerformanceOperation,
  PerformancePreferences,
  PerformanceProgressEvent,
  SavePerformancePreferencesRequest,
  TransactionBenchmarkResult,
  TransactionPage,
  TransactionPageFilters,
} from "@/types/performance";

export function getPerformanceWorkspaceId(): string {
  if (typeof window === "undefined") throw new ApiError("Espaço local indisponível.", 400);
  const workspaceId = window.localStorage.getItem("finance-workspace-id");
  if (!workspaceId) throw new ApiError("Selecione um espaço financeiro local.", 400);
  return workspaceId;
}

function ensureDesktop(): void {
  if (!hasTauriRuntime()) throw new ApiError("Os recursos de desempenho estão disponíveis no aplicativo Desktop.", 400);
}

function assertWritable(): void {
  ensureDesktop();
  if (isSafeModeEnabled()) throw new ApiError("O modo seguro está ativo. A manutenção não pode alterar o banco.", 423);
}

export function getPerformancePreferences(): Promise<PerformancePreferences> {
  ensureDesktop();
  return invoke<PerformancePreferences>("performance_get_preferences", { workspaceId: getPerformanceWorkspaceId() });
}

export function savePerformancePreferences(request: SavePerformancePreferencesRequest): Promise<PerformancePreferences> {
  assertWritable();
  return invoke<PerformancePreferences>("performance_save_preferences", {
    request: { workspaceId: getPerformanceWorkspaceId(), ...request },
  });
}

export function listTransactionsPage(filters: TransactionPageFilters): Promise<TransactionPage> {
  ensureDesktop();
  return invoke<TransactionPage>("performance_list_transactions_page", {
    request: { workspaceId: getPerformanceWorkspaceId(), ...normalizeTransactionFilters(filters) },
  });
}

export function rebuildTransactionIndex(operationId = crypto.randomUUID()): Promise<PerformanceOperation> {
  assertWritable();
  return invoke<PerformanceOperation>("performance_rebuild_transaction_index", {
    workspaceId: getPerformanceWorkspaceId(),
    operationId,
  });
}

export async function cancelPerformanceOperation(operationId: string): Promise<void> {
  assertWritable();
  await invoke("performance_cancel_operation", { workspaceId: getPerformanceWorkspaceId(), operationId });
}

export function listPerformanceOperations(limit = 50): Promise<PerformanceOperation[]> {
  ensureDesktop();
  return invoke<PerformanceOperation[]>("performance_list_operations", {
    workspaceId: getPerformanceWorkspaceId(),
    limit,
  });
}

export function listPerformanceMetrics(limit = 50): Promise<PerformanceMetric[]> {
  ensureDesktop();
  return invoke<PerformanceMetric[]>("performance_list_metrics", {
    workspaceId: getPerformanceWorkspaceId(),
    limit,
  });
}

export function getDatabasePerformanceHealth(): Promise<DatabasePerformanceHealth> {
  ensureDesktop();
  return invoke<DatabasePerformanceHealth>("performance_get_database_health", {
    workspaceId: getPerformanceWorkspaceId(),
  });
}

export function runDatabaseMaintenance(): Promise<MaintenanceResult> {
  assertWritable();
  return invoke<MaintenanceResult>("performance_run_database_maintenance", {
    workspaceId: getPerformanceWorkspaceId(),
  });
}

export function benchmarkTransactionPages(): Promise<TransactionBenchmarkResult> {
  ensureDesktop();
  return invoke<TransactionBenchmarkResult>("performance_benchmark_transactions", {
    workspaceId: getPerformanceWorkspaceId(),
  });
}

export async function listenPerformanceProgress(
  callback: (event: PerformanceProgressEvent) => void,
): Promise<UnlistenFn> {
  ensureDesktop();
  return listen<PerformanceProgressEvent>("performance://progress", (event) => {
    callback(normalizeProgressEvent(event.payload));
  });
}
