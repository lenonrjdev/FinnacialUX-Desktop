import { describe, expect, it } from "vitest";
import {
  createRecoveryReadinessReport,
  emptyRecoveryReadinessRuntimeState,
  isRecoveryDrillDue,
  recordRecoveryDrillFailure,
  recordRecoveryDrillResult,
  selectRecoveryDrillCandidate,
} from "@/lib/recovery-readiness-engine";

const automatic = {
  id: "auto-1",
  fileName: "automatic.fuxbackup",
  filePath: "C:/backup/automatic.fuxbackup",
  createdAt: "2026-07-31T12:00:00.000Z",
  sizeBytes: 1024,
  modulesCount: 12,
  kind: "automatic" as const,
  status: "available" as const,
  integrityStatus: "ok" as const,
  checksumSha256: "a".repeat(64),
  appVersion: "1.2.0",
  schemaVersion: 14,
  encryptionMode: "device" as const,
  errorMessage: null,
};

const preferences = {
  enabled: true,
  runOnStartup: true,
  runOnFocus: true,
  intervalDays: 14 as const,
  maximumBackupAgeDays: 7 as const,
  requireTwoBackups: true,
  notifyOnSuccess: false,
  notifyOnFailure: true,
  historyRetention: 20 as const,
};

describe("recovery readiness engine", () => {
  it("prioriza o backup automático íntegro", () => {
    const manual = { ...automatic, id: "manual", kind: "manual" as const, createdAt: "2026-08-01T12:00:00.000Z" };
    expect(selectRecoveryDrillCandidate([manual, automatic])?.id).toBe("auto-1");
  });

  it("não seleciona arquivo ausente ou corrompido", () => {
    expect(selectRecoveryDrillCandidate([{ ...automatic, status: "missing" }])).toBeNull();
    expect(selectRecoveryDrillCandidate([{ ...automatic, integrityStatus: "failed" }])).toBeNull();
  });

  it("calcula o vencimento do ensaio", () => {
    expect(isRecoveryDrillDue("2026-07-01T00:00:00.000Z", 14, new Date("2026-07-20T00:00:00.000Z"))).toBe(true);
    expect(isRecoveryDrillDue("2026-07-15T00:00:00.000Z", 14, new Date("2026-07-20T00:00:00.000Z"))).toBe(false);
  });

  it("registra aprovação sem guardar conteúdo financeiro", () => {
    const state = recordRecoveryDrillResult(emptyRecoveryReadinessRuntimeState, preferences, {
      status: "passed",
      testedAt: "2026-07-31T13:00:00.000Z",
      backupId: automatic.id,
      fileName: automatic.fileName,
      createdAt: automatic.createdAt,
      schemaVersion: 14,
      appVersion: "1.2.0",
      modulesCount: 12,
      durationMs: 1500,
      reason: "Integridade aprovada.",
    });
    expect(state.lastStatus).toBe("passed");
    expect(state.consecutiveFailures).toBe(0);
    expect(JSON.stringify(state)).not.toContain("saldo");
  });

  it("sanitiza falhas e incrementa bloqueios consecutivos", () => {
    const state = recordRecoveryDrillFailure(emptyRecoveryReadinessRuntimeState, preferences, new Error("password=abc C:\\Users\\Lenon\\backup"));
    expect(state.lastReason).toContain("SEGREDO_REMOVIDO");
    expect(state.lastReason).toContain("CAMINHO_REMOVIDO");
    expect(state.consecutiveFailures).toBe(1);
  });

  it("aprova RPO, RTO, schema e redundância comprovados", () => {
    const runtime = recordRecoveryDrillResult(emptyRecoveryReadinessRuntimeState, preferences, {
      status: "passed",
      testedAt: "2026-07-31T13:00:00.000Z",
      backupId: automatic.id,
      fileName: automatic.fileName,
      createdAt: automatic.createdAt,
      schemaVersion: 14,
      appVersion: "1.2.0",
      modulesCount: 12,
      durationMs: 61_000,
      reason: "Aprovado.",
    });
    const report = createRecoveryReadinessReport({
      backups: [automatic, { ...automatic, id: "auto-2", fileName: "automatic-2.fuxbackup" }],
      preferences,
      runtime,
      now: new Date("2026-07-31T14:00:00.000Z"),
    });
    expect(report.ready).toBe(true);
    expect(report.rpoHours).toBe(2);
    expect(report.rtoMinutes).toBe(2);
  });

  it("bloqueia schema divergente e cópia única quando exigida", () => {
    const report = createRecoveryReadinessReport({
      backups: [{ ...automatic, schemaVersion: 15 }],
      preferences,
      runtime: emptyRecoveryReadinessRuntimeState,
      now: new Date("2026-07-31T14:00:00.000Z"),
    });
    expect(report.ready).toBe(false);
    expect(report.checks.find((item) => item.id === "schema")?.status).toBe("blocked");
    expect(report.checks.find((item) => item.id === "redundancy")?.status).toBe("blocked");
  });
});
