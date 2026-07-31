import { describe, expect, it } from "vitest";
import {
  diagnosticHealthLabel,
  formatDiagnosticSummary,
  groupDiagnosticChecks,
  recommendedRepairs,
  supportPackageFileName,
} from "@/lib/diagnostic-engine";
import type { DiagnosticCheck, DiagnosticSuiteResult } from "@/types/diagnostics";

const checks: DiagnosticCheck[] = [
  {
    code: "database.schema",
    category: "database",
    status: "passed",
    title: "Schema",
    detail: "ok",
    repairAction: null,
    durationMs: 1,
  },
  {
    code: "scheduler.leases",
    category: "scheduler",
    status: "attention",
    title: "Leases",
    detail: "attention",
    repairAction: "release_stale_tasks",
    durationMs: 2,
  },
  {
    code: "privacy.logs",
    category: "privacy",
    status: "attention",
    title: "Logs",
    detail: "attention",
    repairAction: "clear_old_logs",
    durationMs: 2,
  },
  {
    code: "privacy.logs.duplicate",
    category: "privacy",
    status: "attention",
    title: "Logs 2",
    detail: "attention",
    repairAction: "clear_old_logs",
    durationMs: 2,
  },
];

describe("motor de diagnóstico local", () => {
  it("classifica saúde por falhas, atenção e pontuação", () => {
    expect(diagnosticHealthLabel(100, 0, 0)).toBe("healthy");
    expect(diagnosticHealthLabel(92, 0, 1)).toBe("attention");
    expect(diagnosticHealthLabel(40, 0, 0)).toBe("failed");
    expect(diagnosticHealthLabel(95, 1, 0)).toBe("failed");
  });

  it("agrupa verificações na ordem funcional", () => {
    const groups = groupDiagnosticChecks(checks);
    expect(groups.map((group) => group.category)).toEqual(["database", "scheduler", "privacy"]);
    expect(groups[2].checks).toHaveLength(2);
  });

  it("remove reparos duplicados", () => {
    expect(recommendedRepairs(checks)).toEqual(["release_stale_tasks", "clear_old_logs"]);
  });

  it("gera resumo técnico sem dados financeiros", () => {
    const suite: DiagnosticSuiteResult = {
      id: "suite-1",
      status: "attention",
      score: 86,
      checksTotal: 4,
      checksPassed: 1,
      checksAttention: 3,
      checksFailed: 0,
      checks,
      availableRepairs: ["release_stale_tasks", "clear_old_logs"],
      readOnly: false,
      persisted: true,
      startedAt: "2026-07-31T12:00:00Z",
      completedAt: "2026-07-31T12:00:01Z",
    };
    const summary = formatDiagnosticSummary(suite);
    expect(summary).toContain("Pontuação: 86/100");
    expect(summary).toContain("Falhas: 0");
    expect(summary).not.toContain("saldo");
  });

  it("gera nome previsível para o pacote de suporte", () => {
    expect(supportPackageFileName(new Date("2026-07-31T13:45:00Z"))).toBe(
      "FinnacialUX-suporte-2026-07-31T13-45-00.fuxsupport",
    );
  });
});
