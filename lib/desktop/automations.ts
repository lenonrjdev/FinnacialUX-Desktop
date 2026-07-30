import { invoke } from "@tauri-apps/api/core";
import { ApiError } from "@/lib/api/client";
import { isSafeModeEnabled } from "@/lib/desktop/protection";
import type {
  ApplyAutomationRequest,
  AutomationAlertStatus,
  AutomationPreferences,
  AutomationPreview,
  AutomationRun,
} from "@/types/desktop-automations";

export function getAutomationWorkspaceId(): string {
  if (typeof window === "undefined") throw new ApiError("Espaço local indisponível.", 400);
  const workspaceId = window.localStorage.getItem("finance-workspace-id");
  if (!workspaceId) throw new ApiError("Selecione um espaço financeiro local.", 400);
  return workspaceId;
}

function assertWritable(): void {
  if (isSafeModeEnabled()) {
    throw new ApiError("O modo seguro está ativo. Saia do modo seguro para executar automações.", 423);
  }
}

export function getAutomationPreferences(): Promise<AutomationPreferences> {
  return invoke<AutomationPreferences>("automation_get_preferences", {
    workspaceId: getAutomationWorkspaceId(),
  });
}

export async function saveAutomationPreferences(
  preferences: Pick<
    AutomationPreferences,
    "simulationRequired" | "startupScanEnabled" | "dueWindowDays" | "alertOverdue" | "alertUpcoming"
  >,
): Promise<AutomationPreferences> {
  assertWritable();
  return invoke<AutomationPreferences>("automation_save_preferences", {
    request: { workspaceId: getAutomationWorkspaceId(), ...preferences },
  });
}

export function simulateAutomations(referenceDate: string): Promise<AutomationPreview> {
  return invoke<AutomationPreview>("automation_simulate", {
    workspaceId: getAutomationWorkspaceId(),
    referenceDate,
  });
}

export async function applyAutomations(
  request: Omit<ApplyAutomationRequest, "workspaceId">,
): Promise<AutomationRun> {
  assertWritable();
  return invoke<AutomationRun>("automation_apply", {
    request: { workspaceId: getAutomationWorkspaceId(), ...request },
  });
}

export function listAutomationRuns(limit = 20): Promise<AutomationRun[]> {
  return invoke<AutomationRun[]>("automation_list_runs", {
    workspaceId: getAutomationWorkspaceId(),
    limit,
  });
}

export async function undoAutomationRun(runId: string): Promise<AutomationRun> {
  assertWritable();
  return invoke<AutomationRun>("automation_undo_run", {
    workspaceId: getAutomationWorkspaceId(),
    runId,
  });
}

export async function markAutomationAlert(
  alertId: string,
  status: Extract<AutomationAlertStatus, "read" | "dismissed">,
): Promise<void> {
  assertWritable();
  await invoke("automation_mark_alert", {
    workspaceId: getAutomationWorkspaceId(),
    alertId,
    status,
  });
}
