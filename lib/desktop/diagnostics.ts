import { invoke } from "@tauri-apps/api/core";
import { open, save } from "@tauri-apps/plugin-dialog";
import { ApiError } from "@/lib/api/client";
import { getSecurityVaultStatus } from "@/lib/desktop/stronghold";
import { getDesktopUpdaterStatus } from "@/lib/desktop/updater";
import { isSafeModeEnabled } from "@/lib/desktop/protection";
import { hasTauriRuntime } from "@/lib/desktop/runtime";
import { supportPackageFileName } from "@/lib/diagnostic-engine";
import type {
  ApplyDiagnosticRepairRequest,
  ClientDiagnosticContext,
  DiagnosticRepairRecord,
  DiagnosticRunSummary,
  DiagnosticSuiteResult,
  DiagnosticRepairAction,
  RunDiagnosticSuiteRequest,
  SupportPackageResult,
  SupportPackageValidation,
} from "@/types/diagnostics";

export function getDiagnosticsWorkspaceId(): string {
  if (typeof window === "undefined") throw new ApiError("Espaço local indisponível.", 400);
  const workspaceId = window.localStorage.getItem("finance-workspace-id");
  if (!workspaceId) throw new ApiError("Selecione um espaço financeiro local.", 400);
  return workspaceId;
}

function ensureDesktop(): void {
  if (!hasTauriRuntime()) {
    throw new ApiError("O diagnóstico completo está disponível no aplicativo Desktop.", 400);
  }
}

export async function getClientDiagnosticContext(): Promise<ClientDiagnosticContext> {
  ensureDesktop();
  const [vault, updater] = await Promise.all([
    getSecurityVaultStatus(),
    getDesktopUpdaterStatus(),
  ]);
  return {
    strongholdReady: vault.ready,
    backupKeyAvailable: vault.keyAvailable,
    databaseKeyAvailable: vault.databaseKeyAvailable,
    updaterConfigured: updater.configured,
    updaterEndpointHost: updater.endpointHost,
    developmentBuild: updater.developmentBuild,
  };
}

function nativeRequest(request: RunDiagnosticSuiteRequest) {
  return {
    workspaceId: getDiagnosticsWorkspaceId(),
    includeReadWriteTest: request.includeReadWriteTest,
    includeRestoreDrill: request.includeRestoreDrill,
    clientContext: request.clientContext,
  };
}

export function previewDiagnosticSuite(
  request: RunDiagnosticSuiteRequest,
): Promise<DiagnosticSuiteResult> {
  ensureDesktop();
  return invoke<DiagnosticSuiteResult>("diagnostics_preview", {
    request: nativeRequest(request),
  });
}

export function runDiagnosticSuite(
  request: RunDiagnosticSuiteRequest,
): Promise<DiagnosticSuiteResult> {
  ensureDesktop();
  return invoke<DiagnosticSuiteResult>("diagnostics_run_suite", {
    request: nativeRequest(request),
  });
}

export function listDiagnosticRuns(limit = 25): Promise<DiagnosticRunSummary[]> {
  ensureDesktop();
  return invoke<DiagnosticRunSummary[]>("diagnostics_list_runs", {
    workspaceId: getDiagnosticsWorkspaceId(),
    limit,
  });
}

export function listDiagnosticRepairs(limit = 25): Promise<DiagnosticRepairRecord[]> {
  ensureDesktop();
  return invoke<DiagnosticRepairRecord[]>("diagnostics_list_repairs", {
    workspaceId: getDiagnosticsWorkspaceId(),
    limit,
  });
}

export function applyDiagnosticRepair(
  actionKind: DiagnosticRepairAction,
  runId?: string,
): Promise<DiagnosticRepairRecord> {
  ensureDesktop();
  if (isSafeModeEnabled()) {
    throw new ApiError("O modo somente leitura está ativo. Reparos foram bloqueados.", 423);
  }
  const request: ApplyDiagnosticRepairRequest = {
    workspaceId: getDiagnosticsWorkspaceId(),
    actionKind,
    runId: runId ?? null,
  };
  return invoke<DiagnosticRepairRecord>("diagnostics_apply_repair", { request });
}

export function chooseSupportPackageDestination(): Promise<string | null> {
  ensureDesktop();
  return save({
    title: "Exportar pacote de suporte do FinnacialUX",
    defaultPath: supportPackageFileName(),
    filters: [{ name: "Pacote de suporte FinnacialUX", extensions: ["fuxsupport"] }],
  });
}

export async function chooseSupportPackageSource(): Promise<string | null> {
  ensureDesktop();
  const selected = await open({
    title: "Validar pacote de suporte do FinnacialUX",
    multiple: false,
    directory: false,
    filters: [{ name: "Pacote de suporte FinnacialUX", extensions: ["fuxsupport"] }],
  });
  return typeof selected === "string" ? selected : null;
}

export function exportSupportPackage(
  destination: string,
  clientContext: ClientDiagnosticContext,
  includeSanitizedLogs = true,
): Promise<SupportPackageResult> {
  ensureDesktop();
  return invoke<SupportPackageResult>("diagnostics_export_support_package", {
    request: {
      workspaceId: getDiagnosticsWorkspaceId(),
      destination,
      safeMode: isSafeModeEnabled(),
      includeSanitizedLogs,
      clientContext,
    },
  });
}

export function validateSupportPackage(source: string): Promise<SupportPackageValidation> {
  ensureDesktop();
  return invoke<SupportPackageValidation>("diagnostics_validate_support_package", { source });
}
