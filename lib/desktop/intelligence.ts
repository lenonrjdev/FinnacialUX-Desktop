import { invoke } from "@tauri-apps/api/core";
import { ApiError } from "@/lib/api/client";
import { isSafeModeEnabled } from "@/lib/desktop/protection";
import { hasTauriRuntime } from "@/lib/desktop/runtime";
import type {
  IntelligencePreferences,
  IntelligenceSnapshotSummary,
  RecordIntelligenceSnapshotRequest,
  SavedIntelligenceScenario,
  SaveIntelligencePreferencesRequest,
  SaveIntelligenceScenarioRequest,
} from "@/types/financial-intelligence";

export function getIntelligenceWorkspaceId(): string {
  if (typeof window === "undefined") throw new ApiError("Espaço local indisponível.", 400);
  const workspaceId = window.localStorage.getItem("finance-workspace-id");
  if (!workspaceId) throw new ApiError("Selecione um espaço financeiro local.", 400);
  return workspaceId;
}

function ensureDesktop(): void {
  if (!hasTauriRuntime()) {
    throw new ApiError("A inteligência persistida está disponível no aplicativo Desktop.", 400);
  }
}

function assertWritable(): void {
  ensureDesktop();
  if (isSafeModeEnabled()) {
    throw new ApiError("O modo seguro está ativo. Cenários e preferências não podem ser alterados.", 423);
  }
}

export function getIntelligencePreferences(): Promise<IntelligencePreferences> {
  ensureDesktop();
  return invoke<IntelligencePreferences>("intelligence_get_preferences", {
    workspaceId: getIntelligenceWorkspaceId(),
  });
}

export function saveIntelligencePreferences(
  preferences: SaveIntelligencePreferencesRequest,
): Promise<IntelligencePreferences> {
  assertWritable();
  return invoke<IntelligencePreferences>("intelligence_save_preferences", {
    request: { workspaceId: getIntelligenceWorkspaceId(), ...preferences },
  });
}

export function listIntelligenceScenarios(): Promise<SavedIntelligenceScenario[]> {
  ensureDesktop();
  return invoke<SavedIntelligenceScenario[]>("intelligence_list_scenarios", {
    workspaceId: getIntelligenceWorkspaceId(),
  });
}

export function saveIntelligenceScenario(
  scenario: SaveIntelligenceScenarioRequest,
): Promise<SavedIntelligenceScenario> {
  assertWritable();
  return invoke<SavedIntelligenceScenario>("intelligence_save_scenario", {
    request: { workspaceId: getIntelligenceWorkspaceId(), ...scenario },
  });
}

export async function deleteIntelligenceScenario(scenarioId: string): Promise<void> {
  assertWritable();
  await invoke("intelligence_delete_scenario", {
    workspaceId: getIntelligenceWorkspaceId(),
    scenarioId,
  });
}

export function recordIntelligenceSnapshot(
  snapshot: RecordIntelligenceSnapshotRequest,
): Promise<IntelligenceSnapshotSummary> {
  assertWritable();
  return invoke<IntelligenceSnapshotSummary>("intelligence_record_snapshot", {
    request: { workspaceId: getIntelligenceWorkspaceId(), ...snapshot },
  });
}

export function listIntelligenceSnapshots(limit = 12): Promise<IntelligenceSnapshotSummary[]> {
  ensureDesktop();
  return invoke<IntelligenceSnapshotSummary[]>("intelligence_list_snapshots", {
    workspaceId: getIntelligenceWorkspaceId(),
    limit,
  });
}
