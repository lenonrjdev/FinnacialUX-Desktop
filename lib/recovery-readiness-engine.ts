import type { NativeBackupRecord } from "@/types/desktop-protection";
import type {
  RecoveryDrillCandidate,
  RecoveryDrillResult,
  RecoveryReadinessCheck,
  RecoveryReadinessPreferences,
  RecoveryReadinessReport,
  RecoveryReadinessRuntimeState,
} from "@/types/recovery-readiness";

export const defaultRecoveryReadinessPreferences: RecoveryReadinessPreferences = {
  enabled: true,
  runOnStartup: true,
  runOnFocus: true,
  intervalDays: 14,
  maximumBackupAgeDays: 7,
  requireTwoBackups: true,
  notifyOnSuccess: false,
  notifyOnFailure: true,
  historyRetention: 20,
};

export const emptyRecoveryReadinessRuntimeState: RecoveryReadinessRuntimeState = {
  running: false,
  lastTestedAt: null,
  lastPassedAt: null,
  lastStatus: null,
  lastReason: null,
  lastDurationMs: null,
  lastBackupId: null,
  consecutiveFailures: 0,
  history: [],
};

const DAY_MS = 86_400_000;

function validDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function normalizeRecoveryReadinessPreferences(
  value: Partial<RecoveryReadinessPreferences> | null | undefined,
): RecoveryReadinessPreferences {
  const intervalDays = [7, 14, 30].includes(Number(value?.intervalDays))
    ? Number(value?.intervalDays) as RecoveryReadinessPreferences["intervalDays"]
    : defaultRecoveryReadinessPreferences.intervalDays;
  const maximumBackupAgeDays = [1, 3, 7, 14].includes(Number(value?.maximumBackupAgeDays))
    ? Number(value?.maximumBackupAgeDays) as RecoveryReadinessPreferences["maximumBackupAgeDays"]
    : defaultRecoveryReadinessPreferences.maximumBackupAgeDays;
  const historyRetention = [10, 20, 50].includes(Number(value?.historyRetention))
    ? Number(value?.historyRetention) as RecoveryReadinessPreferences["historyRetention"]
    : defaultRecoveryReadinessPreferences.historyRetention;
  return {
    enabled: value?.enabled !== false,
    runOnStartup: value?.runOnStartup !== false,
    runOnFocus: value?.runOnFocus !== false,
    intervalDays,
    maximumBackupAgeDays,
    requireTwoBackups: value?.requireTwoBackups !== false,
    notifyOnSuccess: value?.notifyOnSuccess === true,
    notifyOnFailure: value?.notifyOnFailure !== false,
    historyRetention,
  };
}

export function nextRecoveryDrillAt(
  lastTestedAt: string | null | undefined,
  intervalDays: number,
  now = new Date(),
): Date {
  const last = validDate(lastTestedAt);
  return last ? new Date(last.getTime() + Math.max(1, intervalDays) * DAY_MS) : now;
}

export function isRecoveryDrillDue(
  lastTestedAt: string | null | undefined,
  intervalDays: number,
  now = new Date(),
): boolean {
  return nextRecoveryDrillAt(lastTestedAt, intervalDays, now).getTime() <= now.getTime();
}

export function selectRecoveryDrillCandidate(
  records: NativeBackupRecord[],
): RecoveryDrillCandidate | null {
  const priority: Record<string, number> = {
    automatic: 5,
    recovery_point: 4,
    pre_update: 3,
    pre_restore: 2,
    manual: 1,
  };
  return records
    .filter((record) => record.status === "available" && record.integrityStatus !== "failed" && record.filePath.trim().length > 0)
    .sort((left, right) => {
      const priorityDelta = (priority[right.kind] ?? 0) - (priority[left.kind] ?? 0);
      return priorityDelta || Date.parse(right.createdAt) - Date.parse(left.createdAt);
    })[0] ?? null;
}

export function sanitizeRecoveryDrillError(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error || "Falha desconhecida.");
  return raw
    .replace(/[A-Za-z]:\\[^\s"']+/g, "CAMINHO_REMOVIDO")
    .replace(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/g, "EMAIL_REMOVIDO")
    .replace(/(token|password|senha|secret|key)\s*[:=]\s*[^\s,;]+/gi, "$1=SEGREDO_REMOVIDO")
    .slice(0, 280);
}

export function recordRecoveryDrillResult(
  current: RecoveryReadinessRuntimeState,
  preferences: RecoveryReadinessPreferences,
  result: RecoveryDrillResult,
): RecoveryReadinessRuntimeState {
  const passed = result.status === "passed";
  const entry = { ...result, id: `${result.testedAt}:${result.backupId}` };
  return {
    running: false,
    lastTestedAt: result.testedAt,
    lastPassedAt: passed ? result.testedAt : current.lastPassedAt,
    lastStatus: result.status,
    lastReason: result.reason,
    lastDurationMs: result.durationMs,
    lastBackupId: result.backupId,
    consecutiveFailures: passed ? 0 : current.consecutiveFailures + 1,
    history: [entry, ...current.history].slice(0, preferences.historyRetention),
  };
}

export function recordRecoveryDrillFailure(
  current: RecoveryReadinessRuntimeState,
  preferences: RecoveryReadinessPreferences,
  error: unknown,
  testedAt = new Date().toISOString(),
): RecoveryReadinessRuntimeState {
  const reason = sanitizeRecoveryDrillError(error);
  const result: RecoveryDrillResult = {
    status: "failed",
    testedAt,
    backupId: "none",
    fileName: "",
    createdAt: testedAt,
    schemaVersion: 0,
    appVersion: "",
    modulesCount: 0,
    durationMs: 0,
    reason,
  };
  return recordRecoveryDrillResult(current, preferences, result);
}

function check(
  id: string,
  title: string,
  detail: string,
  status: RecoveryReadinessCheck["status"],
  required = true,
): RecoveryReadinessCheck {
  return { id, title, detail, status, required };
}

export function createRecoveryReadinessReport(input: {
  backups: NativeBackupRecord[];
  preferences: RecoveryReadinessPreferences;
  runtime: RecoveryReadinessRuntimeState;
  now?: Date;
}): RecoveryReadinessReport {
  const now = input.now ?? new Date();
  const candidate = selectRecoveryDrillCandidate(input.backups);
  const available = input.backups.filter((item) => item.status === "available" && item.integrityStatus !== "failed");
  const candidateDate = validDate(candidate?.createdAt);
  const backupAgeHours = candidateDate ? Math.max(0, (now.getTime() - candidateDate.getTime()) / 3_600_000) : null;
  const maximumAgeHours = input.preferences.maximumBackupAgeDays * 24;
  const due = isRecoveryDrillDue(input.runtime.lastTestedAt, input.preferences.intervalDays, now);
  const checks: RecoveryReadinessCheck[] = [
    check(
      "candidate",
      "Cópia recuperável",
      candidate ? `${candidate.fileName} está disponível para um ensaio sem alteração do banco.` : "Nenhuma cópia disponível foi localizada.",
      candidate ? "passed" : "blocked",
    ),
    check(
      "freshness",
      "Objetivo de ponto de recuperação",
      backupAgeHours === null
        ? "Não foi possível calcular a idade da cópia."
        : backupAgeHours <= maximumAgeHours
          ? `A cópia mais recente tem ${Math.max(1, Math.round(backupAgeHours))} hora(s).`
          : `A cópia mais recente ultrapassou ${input.preferences.maximumBackupAgeDays} dia(s).`,
      backupAgeHours === null ? "blocked" : backupAgeHours <= maximumAgeHours ? "passed" : "blocked",
    ),
    check(
      "drill",
      "Ensaio de restauração",
      !input.runtime.lastTestedAt
        ? "Nenhum ensaio foi executado neste computador."
        : input.runtime.lastStatus === "passed" && !due
          ? "A última simulação abriu, descriptografou e validou a cópia com sucesso."
          : input.runtime.lastStatus === "passed"
            ? "O último ensaio passou, mas um novo ciclo já está vencido."
            : input.runtime.lastReason ?? "O último ensaio requer atenção.",
      input.runtime.lastStatus === "passed" && !due ? "passed" : input.runtime.lastStatus === "passed" ? "attention" : "blocked",
    ),
    check(
      "schema",
      "Compatibilidade do schema",
      candidate?.schemaVersion === 14
        ? "A cópia está alinhada ao schema SQLCipher 14 congelado."
        : `Schema esperado 14; encontrado ${candidate?.schemaVersion ?? "indisponível"}.`,
      candidate?.schemaVersion === 14 ? "passed" : "blocked",
    ),
    check(
      "redundancy",
      "Redundância local",
      available.length >= 2
        ? `${available.length} cópias íntegras estão disponíveis.`
        : "Existe somente uma cópia recuperável; mantenha uma segunda cópia em outro local.",
      available.length >= 2 ? "passed" : input.preferences.requireTwoBackups ? "blocked" : "attention",
      input.preferences.requireTwoBackups,
    ),
    check(
      "failures",
      "Falhas consecutivas",
      input.runtime.consecutiveFailures === 0
        ? "Nenhuma falha consecutiva está pendente."
        : `${input.runtime.consecutiveFailures} ensaio(s) consecutivo(s) falharam.`,
      input.runtime.consecutiveFailures === 0 ? "passed" : input.runtime.consecutiveFailures === 1 ? "attention" : "blocked",
      false,
    ),
  ];
  const passed = checks.filter((item) => item.status === "passed").length;
  const attention = checks.filter((item) => item.status === "attention").length;
  const blocked = checks.filter((item) => item.status === "blocked").length;
  const score = Math.max(0, Math.round((passed * 100 + attention * 55) / checks.length));
  const ready = checks.every((item) => !item.required || item.status === "passed");
  const status = ready ? "ready" : blocked > 0 ? "blocked" : "attention";
  const rtoMinutes = input.runtime.lastDurationMs === null ? null : Math.max(1, Math.ceil(input.runtime.lastDurationMs / 60_000));
  const plan = [
    "Bloquear novas gravações e preservar o banco atual em modo somente leitura.",
    candidate ? `Confirmar o checksum e a integridade de ${candidate.fileName}.` : "Selecionar a cópia íntegra mais recente.",
    "Criar uma cópia de segurança pré-restauração protegida pelo Stronghold.",
    "Restaurar de forma atômica e executar integridade, chaves estrangeiras e schema.",
    "Entrar novamente, conferir contas críticas e registrar o incidente no histórico local.",
  ];
  return {
    ready,
    status,
    score,
    rpoHours: backupAgeHours === null ? null : Math.max(0, Math.ceil(backupAgeHours)),
    rtoMinutes,
    nextDrillAt: input.preferences.enabled
      ? nextRecoveryDrillAt(input.runtime.lastTestedAt, input.preferences.intervalDays, now).toISOString()
      : null,
    checks,
    plan,
  };
}
