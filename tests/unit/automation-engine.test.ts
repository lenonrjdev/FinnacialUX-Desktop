import { describe, expect, it } from "vitest";
import {
  advanceAutomationDate,
  automationFrequencyLabel,
  buildDueOccurrenceDates,
  canUndoAutomationRun,
  summarizeAutomationCandidates,
} from "@/lib/automation-engine";
import type { AutomationCandidate, AutomationRun } from "@/types/desktop-automations";

function candidate(kind: "rule" | "suggestion" | "recurrence", id: string): AutomationCandidate {
  return {
    id,
    kind,
    title: id,
    description: id,
    targetModule: "transactions",
    targetId: id,
    ruleId: kind === "rule" ? id : null,
    templateId: kind === "recurrence" ? id : null,
    occurrenceDate: null,
    before: null,
    after: {},
  };
}

describe("motor local de automações", () => {
  it("avança frequências sem depender de serviços externos", () => {
    expect(advanceAutomationDate("2026-07-30", "weekly")).toBe("2026-08-06");
    expect(advanceAutomationDate("2026-07-30", "monthly")).toBe("2026-08-30");
    expect(advanceAutomationDate("2026-07-30", "quarterly")).toBe("2026-10-30");
    expect(advanceAutomationDate("2026-07-30", "yearly")).toBe("2027-07-30");
    expect(advanceAutomationDate("2027-01-31", "monthly")).toBe("2027-02-28");
  });

  it("limita ocorrências vencidas para evitar geração descontrolada", () => {
    const dates = buildDueOccurrenceDates({
      active: true,
      frequency: "weekly",
      interval: 1,
      nextRunAt: "2026-01-01",
    }, "2026-07-30", 4);
    expect(dates).toHaveLength(4);
    expect(dates[0]).toBe("2026-01-01");
  });

  it("não gera ocorrências para modelos pausados", () => {
    expect(buildDueOccurrenceDates({
      active: false,
      frequency: "monthly",
      interval: 1,
      nextRunAt: "2026-07-01",
    }, "2026-07-30")).toEqual([]);
  });

  it("resume candidatos por origem", () => {
    expect(summarizeAutomationCandidates([
      candidate("rule", "1"),
      candidate("rule", "2"),
      candidate("suggestion", "3"),
      candidate("recurrence", "4"),
    ], 4)).toEqual({
      ruleChanges: 2,
      learnedSuggestions: 1,
      recurringTransactions: 1,
      alerts: 4,
      totalCandidates: 4,
    });
  });

  it("só permite desfazer execução aplicada e ainda reversível", () => {
    const run = {
      status: "applied",
      reversible: true,
      undoneAt: null,
    } as AutomationRun;
    expect(canUndoAutomationRun(run)).toBe(true);
    expect(canUndoAutomationRun({ ...run, undoneAt: "2026-07-30" })).toBe(false);
    expect(automationFrequencyLabel("quarterly")).toBe("Trimestral");
  });
});
