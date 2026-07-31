import { invoke } from "@tauri-apps/api/core";
import { ApiError } from "@/lib/api/client";
import { isSafeModeEnabled } from "@/lib/desktop/protection";
import { hasTauriRuntime } from "@/lib/desktop/runtime";
import type {
  ApplyReconciliationImportRequest,
  CloseMonthRequest,
  ClosureEvent,
  ClosurePreviewRequest,
  MonthlyClosure,
  MonthlyClosurePreview,
  PreviewReconciliationImportRequest,
  ReconciliationEvidence,
  ReconciliationEvidenceFile,
  ReconciliationImportRecord,
  ReconciliationPreferences,
  ReconciliationPreview,
  ReopenMonthRequest,
  SaveReconciliationEvidenceRequest,
  SaveReconciliationPreferencesRequest,
} from "@/types/reconciliation";

export function getReconciliationWorkspaceId(): string {
  if (typeof window === "undefined") throw new ApiError("Espaço local indisponível.", 400);
  const workspaceId = window.localStorage.getItem("finance-workspace-id");
  if (!workspaceId) throw new ApiError("Selecione um espaço financeiro local.", 400);
  return workspaceId;
}

function ensureDesktop(): void {
  if (!hasTauriRuntime()) throw new ApiError("A conciliação persistida está disponível no aplicativo Desktop.", 400);
}

function assertWritable(): void {
  ensureDesktop();
  if (isSafeModeEnabled()) throw new ApiError("O modo seguro está ativo. A conciliação não pode alterar dados.", 423);
}

export function getReconciliationPreferences(): Promise<ReconciliationPreferences> {
  ensureDesktop();
  return invoke<ReconciliationPreferences>("reconciliation_get_preferences", { workspaceId: getReconciliationWorkspaceId() });
}

export function saveReconciliationPreferences(request: SaveReconciliationPreferencesRequest): Promise<ReconciliationPreferences> {
  assertWritable();
  return invoke<ReconciliationPreferences>("reconciliation_save_preferences", { request: { workspaceId: getReconciliationWorkspaceId(), ...request } });
}

export function previewReconciliationImport(request: PreviewReconciliationImportRequest): Promise<ReconciliationPreview> {
  ensureDesktop();
  return invoke<ReconciliationPreview>("reconciliation_preview_import", { request: { workspaceId: getReconciliationWorkspaceId(), ...request } });
}

export function applyReconciliationImport(request: ApplyReconciliationImportRequest): Promise<ReconciliationImportRecord> {
  assertWritable();
  return invoke<ReconciliationImportRecord>("reconciliation_apply_import", { request: { workspaceId: getReconciliationWorkspaceId(), ...request } });
}

export function listReconciliationImports(limit = 100): Promise<ReconciliationImportRecord[]> {
  ensureDesktop();
  return invoke<ReconciliationImportRecord[]>("reconciliation_list_imports", { workspaceId: getReconciliationWorkspaceId(), limit });
}

export async function undoReconciliationImport(importId: string): Promise<void> {
  assertWritable();
  await invoke("reconciliation_undo_import", { workspaceId: getReconciliationWorkspaceId(), importId });
}

export function previewMonthlyClosure(request: ClosurePreviewRequest): Promise<MonthlyClosurePreview> {
  ensureDesktop();
  return invoke<MonthlyClosurePreview>("reconciliation_preview_closure", { request: { workspaceId: getReconciliationWorkspaceId(), ...request } });
}

export function closeFinancialMonth(request: CloseMonthRequest): Promise<MonthlyClosure> {
  assertWritable();
  return invoke<MonthlyClosure>("reconciliation_close_month", { request: { workspaceId: getReconciliationWorkspaceId(), ...request } });
}

export function listMonthlyClosures(limit = 100): Promise<MonthlyClosure[]> {
  ensureDesktop();
  return invoke<MonthlyClosure[]>("reconciliation_list_closures", { workspaceId: getReconciliationWorkspaceId(), limit });
}

export function reopenFinancialMonth(request: ReopenMonthRequest): Promise<MonthlyClosure> {
  assertWritable();
  return invoke<MonthlyClosure>("reconciliation_reopen_month", { request: { workspaceId: getReconciliationWorkspaceId(), ...request } });
}

export function listClosureEvents(closureId?: string, limit = 100): Promise<ClosureEvent[]> {
  ensureDesktop();
  return invoke<ClosureEvent[]>("reconciliation_list_events", { workspaceId: getReconciliationWorkspaceId(), closureId: closureId ?? null, limit });
}

export function saveReconciliationEvidence(request: SaveReconciliationEvidenceRequest): Promise<ReconciliationEvidence> {
  assertWritable();
  return invoke<ReconciliationEvidence>("reconciliation_save_evidence", { request: { workspaceId: getReconciliationWorkspaceId(), ...request } });
}

export function listReconciliationEvidence(transactionId?: string, limit = 100): Promise<ReconciliationEvidence[]> {
  ensureDesktop();
  return invoke<ReconciliationEvidence[]>("reconciliation_list_evidence", { workspaceId: getReconciliationWorkspaceId(), transactionId: transactionId ?? null, limit });
}

export function readReconciliationEvidence(evidenceId: string): Promise<ReconciliationEvidenceFile> {
  ensureDesktop();
  return invoke<ReconciliationEvidenceFile>("reconciliation_read_evidence", {
    workspaceId: getReconciliationWorkspaceId(),
    evidenceId,
  });
}

export async function deleteReconciliationEvidence(evidenceId: string): Promise<void> {
  assertWritable();
  await invoke("reconciliation_delete_evidence", { workspaceId: getReconciliationWorkspaceId(), evidenceId });
}
