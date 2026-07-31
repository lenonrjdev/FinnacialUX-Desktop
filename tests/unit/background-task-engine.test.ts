import { describe, expect, it } from "vitest";
import {
  calculateRetryDelayMinutes,
  enabledTaskKinds,
  isWithinQuietHours,
  normalizeClock,
  schedulerNextTick,
  taskDedupKey,
} from "@/lib/background-task-engine";

describe("motor local de rotinas em segundo plano", () => {
  it("normaliza horários inválidos sem aceitar valores fora do relógio", () => {
    expect(normalizeClock("23:45", "22:00")).toBe("23:45");
    expect(normalizeClock("25:00", "22:00")).toBe("22:00");
  });

  it("reconhece silêncio que atravessa a meia-noite", () => {
    expect(isWithinQuietHours(new Date("2026-07-31T23:00:00-03:00"), "22:00", "08:00")).toBe(true);
    expect(isWithinQuietHours(new Date("2026-07-31T12:00:00-03:00"), "22:00", "08:00")).toBe(false);
  });

  it("aplica backoff exponencial limitado", () => {
    expect([1, 2, 3, 4, 5, 6].map(calculateRetryDelayMinutes)).toEqual([5, 10, 20, 40, 80, 160]);
    expect(calculateRetryDelayMinutes(99)).toBe(160);
  });

  it("calcula o próximo tick respeitando os limites operacionais", () => {
    const next = schedulerNextTick("2026-07-31T12:00:00.000Z", 30, new Date("2026-07-31T12:10:00.000Z"));
    expect(next.toISOString()).toBe("2026-07-31T12:30:00.000Z");
  });

  it("gera chaves diárias, mensais e semanais estáveis", () => {
    const date = new Date("2026-07-31T12:00:00.000Z");
    expect(taskDedupKey("due_alerts", date)).toBe("due_alerts:2026-07-31");
    expect(taskDedupKey("monthly_closing", date)).toBe("monthly_closing:2026-07");
    expect(taskDedupKey("weekly_summary", date)).toBe("weekly_summary:2026-07-27");
  });

  it("agenda somente as rotinas habilitadas", () => {
    expect(enabledTaskKinds({
      workspaceId: "workspace",
      enabled: true,
      paused: false,
      runOnStartup: true,
      intervalMinutes: 30,
      nativeNotifications: true,
      quietHoursEnabled: true,
      quietHoursStart: "22:00",
      quietHoursEnd: "08:00",
      automationScanEnabled: true,
      dueAlertsEnabled: true,
      financialRiskEnabled: false,
      goalsBudgetEnabled: true,
      monthlyClosingEnabled: false,
      backupReminderEnabled: true,
      weeklySummaryEnabled: false,
      retryLimit: 3,
      lastSchedulerTickAt: null,
      lastSuccessfulRunAt: null,
      updatedAt: "2026-07-31T12:00:00.000Z",
    })).toEqual(["automation_scan", "due_alerts", "goals_budget", "backup_reminder"]);
  });
});
