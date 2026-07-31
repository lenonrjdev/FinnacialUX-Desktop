import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { ApiError } from "@/lib/api/client";
import { isSafeModeEnabled } from "@/lib/desktop/protection";
import type {
  BackgroundNotification,
  BackgroundNotificationEvent,
  BackgroundRunResult,
  BackgroundSchedulerStatus,
  BackgroundTask,
  BackgroundTaskPreferences,
  BackgroundTaskRun,
  SaveBackgroundTaskPreferences,
} from "@/types/background-tasks";

export function getBackgroundWorkspaceId(): string {
  if (typeof window === "undefined") throw new ApiError("Espaço local indisponível.", 400);
  const workspaceId = window.localStorage.getItem("finance-workspace-id");
  if (!workspaceId) throw new ApiError("Selecione um espaço financeiro local.", 400);
  return workspaceId;
}

function assertWritable(): void {
  if (isSafeModeEnabled()) {
    throw new ApiError("O modo somente leitura está ativo. As rotinas locais não podem alterar a fila.", 423);
  }
}

export function getBackgroundTaskPreferences(): Promise<BackgroundTaskPreferences> {
  return invoke<BackgroundTaskPreferences>("background_get_preferences", { workspaceId: getBackgroundWorkspaceId() });
}

export async function saveBackgroundTaskPreferences(
  preferences: SaveBackgroundTaskPreferences,
): Promise<BackgroundTaskPreferences> {
  assertWritable();
  return invoke<BackgroundTaskPreferences>("background_save_preferences", {
    request: { workspaceId: getBackgroundWorkspaceId(), ...preferences },
  });
}

export function startBackgroundScheduler(runStartup = true): Promise<BackgroundRunResult> {
  return invoke<BackgroundRunResult>("background_start_scheduler", {
    workspaceId: getBackgroundWorkspaceId(),
    runStartup,
  });
}

export function stopBackgroundScheduler(): Promise<void> {
  return invoke<void>("background_stop_scheduler", { workspaceId: getBackgroundWorkspaceId() });
}

export function runBackgroundTasks(force = false): Promise<BackgroundRunResult> {
  return invoke<BackgroundRunResult>("background_run_due_tasks", { workspaceId: getBackgroundWorkspaceId(), force });
}

export function getBackgroundSchedulerStatus(): Promise<BackgroundSchedulerStatus> {
  return invoke<BackgroundSchedulerStatus>("background_get_status", { workspaceId: getBackgroundWorkspaceId() });
}

export function listBackgroundTasks(status?: BackgroundTask["status"], limit = 50): Promise<BackgroundTask[]> {
  return invoke<BackgroundTask[]>("background_list_tasks", {
    workspaceId: getBackgroundWorkspaceId(),
    status: status ?? null,
    limit,
  });
}

export function listBackgroundTaskRuns(limit = 50): Promise<BackgroundTaskRun[]> {
  return invoke<BackgroundTaskRun[]>("background_list_runs", { workspaceId: getBackgroundWorkspaceId(), limit });
}

export async function cancelBackgroundTask(taskId: string): Promise<BackgroundTask> {
  assertWritable();
  return invoke<BackgroundTask>("background_cancel_task", { workspaceId: getBackgroundWorkspaceId(), taskId });
}

export async function retryBackgroundTask(taskId: string): Promise<BackgroundTask> {
  assertWritable();
  return invoke<BackgroundTask>("background_retry_task", { workspaceId: getBackgroundWorkspaceId(), taskId });
}

export function listBackgroundNotifications(limit = 50): Promise<BackgroundNotification[]> {
  return invoke<BackgroundNotification[]>("background_list_notifications", { workspaceId: getBackgroundWorkspaceId(), limit });
}

export function flushBackgroundNotifications(): Promise<BackgroundNotification[]> {
  return invoke<BackgroundNotification[]>("background_flush_notifications", { workspaceId: getBackgroundWorkspaceId() });
}

export async function acknowledgeBackgroundNotification(
  notificationId: string,
  delivered: boolean,
  failureReason?: string,
): Promise<BackgroundNotification> {
  return invoke<BackgroundNotification>("background_ack_notification", {
    workspaceId: getBackgroundWorkspaceId(),
    notificationId,
    delivered,
    failureReason: failureReason ?? null,
  });
}

export function listenBackgroundNotifications(
  callback: (notification: BackgroundNotification) => void,
): Promise<UnlistenFn> {
  return listen<BackgroundNotificationEvent>("finnacialux-background-notification", (event) => {
    callback(event.payload.notification);
  });
}

export function listenBackgroundRunRequests(callback: () => void): Promise<UnlistenFn> {
  return listen("finnacialux-background-run-requested-native", () => callback());
}
