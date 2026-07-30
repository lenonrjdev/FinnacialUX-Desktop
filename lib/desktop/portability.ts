import { invoke } from "@tauri-apps/api/core";
import { ApiError } from "@/lib/api/client";
import { isSafeModeEnabled } from "@/lib/desktop/protection";
import type {
  PortableImportMode,
  PortabilityOperation,
  PortabilityOperationInput,
} from "@/types/dados-e-automacoes";

export function getLocalWorkspaceId(): string {
  if (typeof window === "undefined") throw new ApiError("Espaço local indisponível.", 400);
  const workspaceId = window.localStorage.getItem("finance-workspace-id");
  if (!workspaceId) throw new ApiError("Selecione um espaço financeiro local.", 400);
  return workspaceId;
}

export function getWorkspaceDocuments(): Promise<Record<string, unknown>> {
  return invoke<Record<string, unknown>>("portability_get_workspace_documents", {
    workspaceId: getLocalWorkspaceId(),
  });
}

export function listPortabilityOperations(): Promise<PortabilityOperation[]> {
  return invoke<PortabilityOperation[]>("portability_list_operations", {
    workspaceId: getLocalWorkspaceId(),
  });
}

export async function applyPortabilityDocuments(options: {
  documents: Record<string, unknown>;
  mode: PortableImportMode;
  operation: PortabilityOperationInput;
}): Promise<PortabilityOperation> {
  if (isSafeModeEnabled()) throw new ApiError("O modo seguro está ativo. Saia do modo seguro para importar dados.", 423);
  return invoke<PortabilityOperation>("portability_apply_documents", {
    request: {
      workspaceId: getLocalWorkspaceId(),
      documents: options.documents,
      mode: options.mode,
      operation: options.operation,
    },
  });
}

export function recordPortabilityOperation(operation: PortabilityOperationInput): Promise<PortabilityOperation> {
  return invoke<PortabilityOperation>("portability_record_operation", {
    workspaceId: getLocalWorkspaceId(),
    operation,
  });
}

export async function undoPortabilityOperation(operationId: string): Promise<void> {
  if (isSafeModeEnabled()) throw new ApiError("O modo seguro está ativo. Saia do modo seguro para desfazer a importação.", 423);
  await invoke("portability_undo_operation", {
    workspaceId: getLocalWorkspaceId(),
    operationId,
  });
}
