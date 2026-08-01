import { describe, expect, it } from "vitest";
import {
  createExternalBackupHealth,
  recordExternalBackupFailure,
  sanitizeExternalBackupError,
  selectExternalBackupCandidate,
} from "@/lib/external-backup-engine";
import { emptyExternalBackupRuntimeState } from "@/lib/external-backup-engine";

const preferences = {
  enabled: true,
  destinationDirectory: "E:\\Financeiro",
  mirrorOnStartup: true,
  mirrorOnFocus: true,
  mirrorAfterBackup: true,
  retentionCount: 10 as const,
  verifyAfterCopy: true,
  notifyOnSuccess: false,
  notifyOnFailure: true,
  lastMirroredAt: "2026-07-31T20:00:00.000Z",
  lastVerifiedAt: "2026-07-31T20:00:00.000Z",
};

const destination = {
  configured: true,
  available: true,
  writable: true,
  independent: true,
  destinationDirectory: "E:\\Financeiro",
  managedDirectory: "E:\\Financeiro\\FinnacialUX-Backups",
  destinationKind: "secondary-volume" as const,
  reason: "Destino disponível.",
  checkedAt: "2026-07-31T20:00:00.000Z",
};

const backup = (overrides = {}) => ({
  id: "backup-1",
  fileName: "automatico.fuxbackup",
  filePath: "C:\\Dados\\backups\\automatico.fuxbackup",
  createdAt: "2026-07-31T20:00:00.000Z",
  sizeBytes: 100,
  modulesCount: 10,
  kind: "automatic" as const,
  status: "available" as const,
  integrityStatus: "ok" as const,
  checksumSha256: "a".repeat(64),
  appVersion: "1.4.0",
  schemaVersion: 14,
  encryptionMode: "device" as const,
  errorMessage: null,
  ...overrides,
});

describe("external backup engine", () => {
  it("prioriza backup automático criptografado e íntegro", () => {
    const selected = selectExternalBackupCandidate([
      backup({ id: "manual", kind: "manual", createdAt: "2026-08-01T00:00:00.000Z" }),
      backup({ id: "automatic" }),
    ]);
    expect(selected?.id).toBe("automatic");
  });

  it("recusa backups sem criptografia", () => {
    expect(selectExternalBackupCandidate([backup({ encryptionMode: "none" })])).toBeNull();
  });

  it("aprova destino independente com cópia recente e válida", () => {
    const report = createExternalBackupHealth({
      preferences,
      destination,
      verification: { status: destination, copies: [], validCount: 1, invalidCount: 0, latestCopyAt: "2026-07-31T20:00:00.000Z", checkedAt: "2026-07-31T20:00:00.000Z", reason: "OK" },
      runtime: emptyExternalBackupRuntimeState,
      now: new Date("2026-08-01T00:00:00.000Z"),
    });
    expect(report.status).toBe("protected");
    expect(report.score).toBe(100);
  });

  it("marca destino no mesmo volume como atenção", () => {
    const report = createExternalBackupHealth({ preferences, destination: { ...destination, independent: false, destinationKind: "same-volume" }, verification: null, runtime: emptyExternalBackupRuntimeState });
    expect(report.status).toBe("attention");
  });

  it("bloqueia mídia desconectada", () => {
    const report = createExternalBackupHealth({ preferences, destination: { ...destination, available: false, writable: false, reason: "Desconectada" }, verification: null, runtime: emptyExternalBackupRuntimeState });
    expect(report.status).toBe("blocked");
  });

  it("sanitiza caminhos e segredos no histórico", () => {
    const message = sanitizeExternalBackupError("C:\\Users\\Lenon\\segredo token=abc123 email teste@example.com");
    expect(message).toContain("CAMINHO_REMOVIDO");
    expect(message).toContain("SEGREDO_REMOVIDO");
    expect(message).toContain("EMAIL_REMOVIDO");
  });

  it("incrementa falhas sem armazenar dados sensíveis", () => {
    const state = recordExternalBackupFailure(emptyExternalBackupRuntimeState, new Error("password=abc C:\\privado\\arquivo"));
    expect(state.consecutiveFailures).toBe(1);
    expect(state.lastReason).not.toContain("abc");
  });
});
