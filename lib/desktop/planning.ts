import { invoke } from "@tauri-apps/api/core";
import { ApiError } from "@/lib/api/client";
import { isSafeModeEnabled } from "@/lib/desktop/protection";
import { hasTauriRuntime } from "@/lib/desktop/runtime";
import type {
  ActivateFinancialPlanRequest,
  FinancialPlanReview,
  PlanningDecision,
  PlanningDecisionStatus,
  PlanningPreferences,
  RecordFinancialPlanReviewRequest,
  SavedFinancialPlan,
  SaveFinancialPlanRequest,
  SavePlanningDecisionRequest,
  SavePlanningPreferencesRequest,
} from "@/types/financial-planning";

export function getPlanningWorkspaceId(): string {
  if (typeof window === "undefined") throw new ApiError("Espaço local indisponível.", 400);
  const workspaceId = window.localStorage.getItem("finance-workspace-id");
  if (!workspaceId) throw new ApiError("Selecione um espaço financeiro local.", 400);
  return workspaceId;
}

function ensureDesktop(): void {
  if (!hasTauriRuntime()) throw new ApiError("O planejamento persistido está disponível no aplicativo Desktop.", 400);
}

function assertWritable(): void {
  ensureDesktop();
  if (isSafeModeEnabled()) throw new ApiError("O modo seguro está ativo. Planos e decisões não podem ser alterados.", 423);
}

export function getPlanningPreferences(): Promise<PlanningPreferences> {
  ensureDesktop();
  return invoke<PlanningPreferences>("planning_get_preferences", { workspaceId: getPlanningWorkspaceId() });
}

export function savePlanningPreferences(request: SavePlanningPreferencesRequest): Promise<PlanningPreferences> {
  assertWritable();
  return invoke<PlanningPreferences>("planning_save_preferences", {
    request: { workspaceId: getPlanningWorkspaceId(), ...request },
  });
}

export function listFinancialPlans(): Promise<SavedFinancialPlan[]> {
  ensureDesktop();
  return invoke<SavedFinancialPlan[]>("planning_list_plans", { workspaceId: getPlanningWorkspaceId() });
}

export function saveFinancialPlan(request: SaveFinancialPlanRequest): Promise<SavedFinancialPlan> {
  assertWritable();
  return invoke<SavedFinancialPlan>("planning_save_plan", {
    request: { workspaceId: getPlanningWorkspaceId(), ...request },
  });
}

export function activateFinancialPlan(request: ActivateFinancialPlanRequest): Promise<SavedFinancialPlan> {
  assertWritable();
  return invoke<SavedFinancialPlan>("planning_activate_plan", {
    request: { workspaceId: getPlanningWorkspaceId(), ...request },
  });
}

export async function archiveFinancialPlan(planId: string): Promise<void> {
  assertWritable();
  await invoke("planning_archive_plan", { workspaceId: getPlanningWorkspaceId(), planId });
}

export function recordFinancialPlanReview(request: RecordFinancialPlanReviewRequest): Promise<FinancialPlanReview> {
  assertWritable();
  return invoke<FinancialPlanReview>("planning_record_review", {
    request: { workspaceId: getPlanningWorkspaceId(), ...request },
  });
}

export function listFinancialPlanReviews(planId?: string, limit = 24): Promise<FinancialPlanReview[]> {
  ensureDesktop();
  return invoke<FinancialPlanReview[]>("planning_list_reviews", {
    workspaceId: getPlanningWorkspaceId(),
    planId: planId ?? null,
    limit,
  });
}

export function listPlanningDecisions(status?: PlanningDecisionStatus, limit = 100): Promise<PlanningDecision[]> {
  ensureDesktop();
  return invoke<PlanningDecision[]>("planning_list_decisions", {
    workspaceId: getPlanningWorkspaceId(),
    status: status ?? null,
    limit,
  });
}

export function savePlanningDecision(request: SavePlanningDecisionRequest): Promise<PlanningDecision> {
  assertWritable();
  return invoke<PlanningDecision>("planning_save_decision", {
    request: { workspaceId: getPlanningWorkspaceId(), ...request },
  });
}

export function updatePlanningDecisionStatus(decisionId: string, status: PlanningDecisionStatus): Promise<PlanningDecision> {
  assertWritable();
  return invoke<PlanningDecision>("planning_update_decision_status", {
    workspaceId: getPlanningWorkspaceId(),
    decisionId,
    status,
  });
}

export async function deletePlanningDecision(decisionId: string): Promise<void> {
  assertWritable();
  await invoke("planning_delete_decision", { workspaceId: getPlanningWorkspaceId(), decisionId });
}
