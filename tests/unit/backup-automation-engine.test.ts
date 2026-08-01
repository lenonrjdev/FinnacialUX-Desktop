import { describe, expect, it } from "vitest";
import {
  calculateNextAutomaticBackupAt,
  createBackupAutomationHealth,
  defaultBackupAutomationPreferences,
  emptyBackupAutomationRuntimeState,
  isAutomaticBackupOverdue,
  normalizeBackupAutomationPreferences,
  recordBackupAutomationFailure,
  recordBackupAutomationResult,
  sanitizeBackupAutomationError,
} from "@/lib/backup-automation-engine";

describe("backup automation engine", () => {
  it("normaliza preferências fora dos limites", () => {
    expect(normalizeBackupAutomationPreferences({ checkIntervalMinutes: 999 as 30, historyRetention: 3 as 10 }))
      .toEqual(defaultBackupAutomationPreferences);
  });

  it("calcula periodicidade diária, semanal e mensal sem deriva", () => {
    const base = "2026-07-01T12:00:00.000Z";
    expect(calculateNextAutomaticBackupAt(base, "daily").toISOString()).toBe("2026-07-02T12:00:00.000Z");
    expect(calculateNextAutomaticBackupAt(base, "weekly").toISOString()).toBe("2026-07-08T12:00:00.000Z");
    expect(calculateNextAutomaticBackupAt(base, "monthly").toISOString()).toBe("2026-07-31T12:00:00.000Z");
  });

  it("identifica cópia vencida", () => {
    expect(isAutomaticBackupOverdue("2026-07-01T00:00:00.000Z", "daily", new Date("2026-07-03T00:00:00.000Z"))).toBe(true);
    expect(isAutomaticBackupOverdue("2026-07-02T12:00:00.000Z", "daily", new Date("2026-07-03T00:00:00.000Z"))).toBe(false);
  });

  it("registra criação sem duplicar mais que a retenção", () => {
    let state = emptyBackupAutomationRuntimeState;
    for (let index = 0; index < 12; index += 1) {
      state = recordBackupAutomationResult(state, { ...defaultBackupAutomationPreferences, historyRetention: 10 }, {
        created: true,
        reason: "Backup automático concluído.",
        record: { id: String(index), fileName: `${index}.fuxbackup`, createdAt: `2026-07-${String(index + 1).padStart(2, "0")}T00:00:00.000Z`, status: "available" },
      }, `2026-07-${String(index + 1).padStart(2, "0")}T00:00:00.000Z`);
    }
    expect(state.history).toHaveLength(10);
    expect(state.consecutiveFailures).toBe(0);
    expect(state.lastStatus).toBe("created");
  });

  it("contabiliza falhas e sanitiza dados sensíveis", () => {
    const state = recordBackupAutomationFailure(
      emptyBackupAutomationRuntimeState,
      defaultBackupAutomationPreferences,
      new Error("password=abc arquivo C:\\Users\\Pessoa\\segredo.txt contato teste@example.com"),
    );
    expect(state.consecutiveFailures).toBe(1);
    expect(state.lastReason).toContain("SEGREDO_REMOVIDO");
    expect(state.lastReason).not.toContain("teste@example.com");
    expect(sanitizeBackupAutomationError("token=123")).toContain("SEGREDO_REMOVIDO");
  });

  it("bloqueia saúde sem política e aprova cópia dentro do prazo", () => {
    expect(createBackupAutomationHealth({ automaticEnabled: false, frequency: "daily", lastAutomaticAt: null, runtime: emptyBackupAutomationRuntimeState }).status).toBe("blocked");
    const report = createBackupAutomationHealth({
      automaticEnabled: true,
      frequency: "weekly",
      lastAutomaticAt: "2026-07-30T00:00:00.000Z",
      runtime: { ...emptyBackupAutomationRuntimeState, lastCreatedAt: "2026-07-30T00:00:00.000Z" },
      now: new Date("2026-07-31T00:00:00.000Z"),
    });
    expect(report.status).toBe("protected");
    expect(report.score).toBe(100);
  });
});
