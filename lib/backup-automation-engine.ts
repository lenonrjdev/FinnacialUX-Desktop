import type {
  AutomaticBackupResult,
  BackupAutomationHealth,
  BackupAutomationHistoryEntry,
  BackupAutomationPreferences,
  BackupAutomationRuntimeState,
} from "@/types/backup-automation";
import type { BackupFrequency } from "@/types/configuracoes";

export const defaultBackupAutomationPreferences: BackupAutomationPreferences = {
  runOnStartup: true,
  runOnFocus: true,
  checkIntervalMinutes: 180,
  notifyOnSuccess: false,
  notifyOnFailure: true,
  historyRetention: 20,
};

export const emptyBackupAutomationRuntimeState: BackupAutomationRuntimeState = {
  running: false,
  lastCheckedAt: null,
  lastCreatedAt: null,
  lastStatus: null,
  lastReason: null,
  consecutiveFailures: 0,
  history: [],
};

const frequencyDays: Record<BackupFrequency, number> = {
  daily: 1,
  weekly: 7,
  monthly: 30,
};

export function normalizeBackupAutomationPreferences(
  value: Partial<BackupAutomationPreferences> | null | undefined,
): BackupAutomationPreferences {
  const interval = [30, 60, 180, 360].includes(Number(value?.checkIntervalMinutes))
    ? Number(value?.checkIntervalMinutes) as BackupAutomationPreferences["checkIntervalMinutes"]
    : defaultBackupAutomationPreferences.checkIntervalMinutes;
  const retention = [10, 20, 50].includes(Number(value?.historyRetention))
    ? Number(value?.historyRetention) as BackupAutomationPreferences["historyRetention"]
    : defaultBackupAutomationPreferences.historyRetention;
  return {
    runOnStartup: value?.runOnStartup !== false,
    runOnFocus: value?.runOnFocus !== false,
    checkIntervalMinutes: interval,
    notifyOnSuccess: value?.notifyOnSuccess === true,
    notifyOnFailure: value?.notifyOnFailure !== false,
    historyRetention: retention,
  };
}

export function calculateNextAutomaticBackupAt(
  lastAutomaticAt: string | null | undefined,
  frequency: BackupFrequency,
  now = new Date(),
): Date {
  if (!lastAutomaticAt) return now;
  const parsed = new Date(lastAutomaticAt);
  if (Number.isNaN(parsed.getTime())) return now;
  return new Date(parsed.getTime() + frequencyDays[frequency] * 86_400_000);
}

export function isAutomaticBackupOverdue(
  lastAutomaticAt: string | null | undefined,
  frequency: BackupFrequency,
  now = new Date(),
): boolean {
  return calculateNextAutomaticBackupAt(lastAutomaticAt, frequency, now).getTime() <= now.getTime();
}

function historyEntry(
  checkedAt: string,
  status: BackupAutomationHistoryEntry["status"],
  reason: string,
  result?: AutomaticBackupResult,
): BackupAutomationHistoryEntry {
  return {
    id: `${checkedAt}:${status}:${result?.record?.id ?? "none"}`,
    checkedAt,
    status,
    reason,
    backupId: result?.record?.id ?? null,
    fileName: result?.record?.fileName ?? null,
  };
}

export function recordBackupAutomationResult(
  current: BackupAutomationRuntimeState,
  preferences: BackupAutomationPreferences,
  result: AutomaticBackupResult,
  checkedAt = new Date().toISOString(),
): BackupAutomationRuntimeState {
  const status = result.created ? "created" : "skipped";
  const nextHistory = [historyEntry(checkedAt, status, result.reason, result), ...current.history]
    .slice(0, preferences.historyRetention);
  return {
    running: false,
    lastCheckedAt: checkedAt,
    lastCreatedAt: result.created ? result.record?.createdAt ?? checkedAt : current.lastCreatedAt,
    lastStatus: status,
    lastReason: result.reason,
    consecutiveFailures: 0,
    history: nextHistory,
  };
}

export function recordBackupAutomationFailure(
  current: BackupAutomationRuntimeState,
  preferences: BackupAutomationPreferences,
  error: unknown,
  checkedAt = new Date().toISOString(),
): BackupAutomationRuntimeState {
  const reason = sanitizeBackupAutomationError(error);
  return {
    running: false,
    lastCheckedAt: checkedAt,
    lastCreatedAt: current.lastCreatedAt,
    lastStatus: "failed",
    lastReason: reason,
    consecutiveFailures: current.consecutiveFailures + 1,
    history: [historyEntry(checkedAt, "failed", reason), ...current.history]
      .slice(0, preferences.historyRetention),
  };
}

export function sanitizeBackupAutomationError(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error || "Falha desconhecida.");
  return raw
    .replace(/[A-Za-z]:\\[^\s"']+/g, "CAMINHO_REMOVIDO")
    .replace(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/g, "EMAIL_REMOVIDO")
    .replace(/(token|password|senha|secret|key)\s*[:=]\s*[^\s,;]+/gi, "$1=SEGREDO_REMOVIDO")
    .slice(0, 280);
}

export function createBackupAutomationHealth(input: {
  automaticEnabled: boolean;
  frequency: BackupFrequency;
  lastAutomaticAt: string | null;
  runtime: BackupAutomationRuntimeState;
  now?: Date;
}): BackupAutomationHealth {
  const now = input.now ?? new Date();
  const next = input.automaticEnabled
    ? calculateNextAutomaticBackupAt(input.lastAutomaticAt, input.frequency, now)
    : null;
  const overdue = Boolean(next && next.getTime() <= now.getTime());
  if (!input.automaticEnabled) {
    return {
      status: "blocked",
      score: 25,
      title: "Backup automático desativado",
      detail: "Ative a política de backups para proteger os dados sem depender de ações manuais.",
      nextBackupAt: null,
      overdue: false,
    };
  }
  if (input.runtime.consecutiveFailures >= 2) {
    return {
      status: "blocked",
      score: 40,
      title: "Falhas consecutivas",
      detail: `${input.runtime.consecutiveFailures} tentativas falharam. Revise o cofre local e o espaço em disco.`,
      nextBackupAt: next?.toISOString() ?? null,
      overdue,
    };
  }
  if (overdue || !input.lastAutomaticAt) {
    return {
      status: "attention",
      score: input.runtime.consecutiveFailures ? 55 : 70,
      title: "Cópia pendente",
      detail: "A próxima verificação criará uma cópia quando o núcleo confirmar que ela está vencida.",
      nextBackupAt: next?.toISOString() ?? null,
      overdue: true,
    };
  }
  return {
    status: "protected",
    score: input.runtime.consecutiveFailures ? 82 : 100,
    title: "Proteção automática ativa",
    detail: "A última cópia está dentro da periodicidade configurada e a retenção será aplicada pelo núcleo nativo.",
    nextBackupAt: next?.toISOString() ?? null,
    overdue: false,
  };
}
