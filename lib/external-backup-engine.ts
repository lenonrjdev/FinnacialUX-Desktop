import type { NativeBackupRecord } from "@/types/desktop-protection";
import type {
  ExternalBackupDestinationStatus,
  ExternalBackupHealth,
  ExternalBackupHistoryEntry,
  ExternalBackupMirrorResult,
  ExternalBackupPreferences,
  ExternalBackupRuntimeState,
  ExternalBackupVerification,
} from "@/types/external-backup";

export const emptyExternalBackupRuntimeState: ExternalBackupRuntimeState = {
  running: false,
  lastCheckedAt: null,
  lastCopiedAt: null,
  lastStatus: null,
  lastReason: null,
  consecutiveFailures: 0,
  history: [],
};

export function selectExternalBackupCandidate(backups: NativeBackupRecord[]): NativeBackupRecord | null {
  return backups
    .filter((item) => item.status === "available")
    .filter((item) => item.integrityStatus === "ok")
    .filter((item) => item.encryptionMode === "device" || item.encryptionMode === "password")
    .sort((left, right) => {
      const kindPriority = Number(right.kind === "automatic") - Number(left.kind === "automatic");
      return kindPriority || Date.parse(right.createdAt) - Date.parse(left.createdAt);
    })[0] ?? null;
}

export function sanitizeExternalBackupError(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error || "Falha desconhecida.");
  return raw
    .replace(/[A-Za-z]:\\[^\s"']+/g, "CAMINHO_REMOVIDO")
    .replace(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/g, "EMAIL_REMOVIDO")
    .replace(/(token|password|senha|secret|key)\s*[:=]\s*[^\s,;]+/gi, "$1=SEGREDO_REMOVIDO")
    .slice(0, 280);
}

function entry(
  checkedAt: string,
  status: ExternalBackupHistoryEntry["status"],
  reason: string,
  fileName: string | null,
): ExternalBackupHistoryEntry {
  return { id: `${checkedAt}:${status}:${fileName ?? "none"}`, checkedAt, status, reason, fileName };
}

export function recordExternalBackupMirror(
  current: ExternalBackupRuntimeState,
  result: ExternalBackupMirrorResult,
  checkedAt = new Date().toISOString(),
): ExternalBackupRuntimeState {
  const status = result.copied ? "copied" : "skipped";
  return {
    running: false,
    lastCheckedAt: checkedAt,
    lastCopiedAt: result.copied ? result.copy?.createdAt ?? checkedAt : current.lastCopiedAt,
    lastStatus: status,
    lastReason: result.reason,
    consecutiveFailures: 0,
    history: [entry(checkedAt, status, result.reason, result.copy?.fileName ?? (result.sourceFileName || null)), ...current.history].slice(0, 30),
  };
}

export function recordExternalBackupVerification(
  current: ExternalBackupRuntimeState,
  result: ExternalBackupVerification,
): ExternalBackupRuntimeState {
  return {
    ...current,
    running: false,
    lastCheckedAt: result.checkedAt,
    lastStatus: result.invalidCount === 0 ? "verified" : "failed",
    lastReason: result.reason,
    consecutiveFailures: result.invalidCount === 0 ? 0 : current.consecutiveFailures + 1,
    history: [entry(result.checkedAt, result.invalidCount === 0 ? "verified" : "failed", result.reason, result.copies[0]?.fileName ?? null), ...current.history].slice(0, 30),
  };
}

export function recordExternalBackupFailure(
  current: ExternalBackupRuntimeState,
  error: unknown,
  checkedAt = new Date().toISOString(),
): ExternalBackupRuntimeState {
  const reason = sanitizeExternalBackupError(error);
  return {
    ...current,
    running: false,
    lastCheckedAt: checkedAt,
    lastStatus: "failed",
    lastReason: reason,
    consecutiveFailures: current.consecutiveFailures + 1,
    history: [entry(checkedAt, "failed", reason, null), ...current.history].slice(0, 30),
  };
}

function ageHours(value: string | null, now: Date): number | null {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return Math.max(0, (now.getTime() - parsed.getTime()) / 3_600_000);
}

export function createExternalBackupHealth(input: {
  preferences: ExternalBackupPreferences;
  destination: ExternalBackupDestinationStatus;
  verification: ExternalBackupVerification | null;
  runtime: ExternalBackupRuntimeState;
  now?: Date;
}): ExternalBackupHealth {
  const now = input.now ?? new Date();
  const latestCopyAt = input.verification?.latestCopyAt ?? input.preferences.lastMirroredAt;
  const latestAge = ageHours(latestCopyAt, now);
  if (!input.preferences.enabled) {
    return { status: "blocked", score: 20, title: "Redundância externa desativada", detail: "Ative um destino externo para sobreviver à perda do computador ou do disco local.", latestCopyAt };
  }
  if (!input.destination.configured) {
    return { status: "blocked", score: 25, title: "Destino não configurado", detail: "Escolha uma mídia externa ou pasta sincronizada antes de ativar o espelhamento.", latestCopyAt };
  }
  if (!input.destination.available || !input.destination.writable) {
    return { status: "blocked", score: 35, title: "Destino indisponível", detail: input.destination.reason, latestCopyAt };
  }
  if ((input.verification?.invalidCount ?? 0) > 0 || input.runtime.consecutiveFailures >= 2) {
    return { status: "blocked", score: 45, title: "Cópia externa requer revisão", detail: input.verification?.reason ?? input.runtime.lastReason ?? "Falhas consecutivas foram registradas.", latestCopyAt };
  }
  if (!input.destination.independent) {
    return { status: "attention", score: 65, title: "Destino no mesmo volume", detail: "A cópia funciona, mas não protege contra falha física do disco. Prefira outro volume ou uma pasta sincronizada.", latestCopyAt };
  }
  if (latestAge === null) {
    return { status: "attention", score: 70, title: "Primeira cópia pendente", detail: "O destino está pronto; espelhe o backup criptografado mais recente.", latestCopyAt };
  }
  if (latestAge > 168) {
    return { status: "attention", score: 78, title: "Cópia externa antiga", detail: `A última cópia recuperável tem ${Math.floor(latestAge / 24)} dias.`, latestCopyAt };
  }
  return { status: "protected", score: 100, title: "Redundância externa ativa", detail: "Existe uma cópia criptografada, independente e verificada por SHA-256.", latestCopyAt };
}
