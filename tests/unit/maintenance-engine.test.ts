import { describe, expect, it } from "vitest";
import {
  DEFAULT_MAINTENANCE_PREFERENCES,
  createMaintenanceReport,
  deferUpdates,
  isUpdateDeferred,
  isWithinMaintenanceWindow,
  nextMaintenanceWindow,
} from "@/lib/maintenance-engine";

const snapshot = {
  currentVersion: "1.5.0",
  schemaVersion: 14,
  updaterConfigured: true,
  backupBeforeInstall: true,
  latestBackupAt: "2026-07-28T12:00:00.000Z",
  latestDiagnosticAt: "2026-07-20T12:00:00.000Z",
  unresolvedTechnicalErrors: 0,
  readOnly: false,
  now: "2026-07-31T12:00:00.000Z",
};

describe("maintenance engine", () => {
  it("aprova uma base 1.5.0 protegida e sem alterar o schema", () => {
    const report = createMaintenanceReport(snapshot, { ...DEFAULT_MAINTENANCE_PREFERENCES, lastMaintenanceAt: "2026-07-25T12:00:00.000Z" });
    expect(report.ready).toBe(true);
    expect(report.blocked).toBe(0);
    expect(report.checks.find((item) => item.id === "schema")?.status).toBe("passed");
  });

  it("bloqueia divergência do schema congelado", () => {
    const report = createMaintenanceReport({ ...snapshot, schemaVersion: 15 }, DEFAULT_MAINTENANCE_PREFERENCES);
    expect(report.ready).toBe(false);
    expect(report.checks.find((item) => item.id === "schema")?.status).toBe("blocked");
  });

  it("calcula janela semanal sem executar fora do período", () => {
    const preferences = { ...DEFAULT_MAINTENANCE_PREFERENCES, maintenanceWeekday: 5 as const, maintenanceStartHour: 9, maintenanceWindowDuration: 2 as const };
    expect(isWithinMaintenanceWindow(preferences, new Date("2026-07-31T09:30:00"))).toBe(true);
    expect(isWithinMaintenanceWindow(preferences, new Date("2026-07-31T12:00:00"))).toBe(false);
  });

  it("calcula a próxima janela no futuro", () => {
    const next = nextMaintenanceWindow(DEFAULT_MAINTENANCE_PREFERENCES, new Date("2026-07-31T12:00:00"));
    expect(next.getTime()).toBeGreaterThan(new Date("2026-07-31T12:00:00").getTime());
  });

  it("adia atualizações por período finito", () => {
    const now = new Date("2026-07-31T12:00:00.000Z");
    const deferred = deferUpdates(DEFAULT_MAINTENANCE_PREFERENCES, 3, now);
    expect(isUpdateDeferred(deferred, new Date("2026-08-01T12:00:00.000Z"))).toBe(true);
    expect(isUpdateDeferred(deferred, new Date("2026-08-04T13:00:00.000Z"))).toBe(false);
  });

  it("trata modo somente leitura como atenção e não como corrupção", () => {
    const report = createMaintenanceReport({ ...snapshot, readOnly: true }, DEFAULT_MAINTENANCE_PREFERENCES);
    expect(report.checks.find((item) => item.id === "read-only")?.status).toBe("attention");
  });
});
