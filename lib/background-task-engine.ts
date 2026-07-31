import type { BackgroundTaskKind, BackgroundTaskPreferences } from "@/types/background-tasks";

export const backgroundTaskLabels: Record<BackgroundTaskKind, string> = {
  automation_scan: "Revisar automações",
  due_alerts: "Verificar vencimentos",
  financial_risk: "Verificar riscos financeiros",
  goals_budget: "Revisar metas e orçamentos",
  monthly_closing: "Lembrar fechamento mensal",
  backup_reminder: "Lembrar backup",
  weekly_summary: "Preparar resumo semanal",
};

export function normalizeClock(value: string, fallback: string): string {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(value) ? value : fallback;
}

function clockMinutes(value: string): number {
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

export function isWithinQuietHours(now: Date, start: string, end: string): boolean {
  const current = now.getHours() * 60 + now.getMinutes();
  const startMinutes = clockMinutes(normalizeClock(start, "22:00"));
  const endMinutes = clockMinutes(normalizeClock(end, "08:00"));
  if (startMinutes === endMinutes) return true;
  if (startMinutes < endMinutes) return current >= startMinutes && current < endMinutes;
  return current >= startMinutes || current < endMinutes;
}

export function calculateRetryDelayMinutes(attempt: number): number {
  const safeAttempt = Math.max(1, Math.min(6, Math.trunc(attempt)));
  return Math.min(240, 5 * 2 ** (safeAttempt - 1));
}

export function schedulerNextTick(lastTickAt: string | null, intervalMinutes: number, now = new Date()): Date {
  const interval = Math.max(15, Math.min(240, Math.trunc(intervalMinutes || 30)));
  const baseline = lastTickAt ? new Date(lastTickAt) : now;
  const validBaseline = Number.isNaN(baseline.getTime()) ? now : baseline;
  return new Date(validBaseline.getTime() + interval * 60_000);
}

export function taskDedupKey(kind: BackgroundTaskKind, reference: Date): string {
  const day = reference.toISOString().slice(0, 10);
  if (kind === "weekly_summary") {
    const date = new Date(Date.UTC(reference.getUTCFullYear(), reference.getUTCMonth(), reference.getUTCDate()));
    const weekday = date.getUTCDay() || 7;
    date.setUTCDate(date.getUTCDate() - weekday + 1);
    return `${kind}:${date.toISOString().slice(0, 10)}`;
  }
  if (kind === "monthly_closing") return `${kind}:${day.slice(0, 7)}`;
  return `${kind}:${day}`;
}

export function enabledTaskKinds(preferences: BackgroundTaskPreferences): BackgroundTaskKind[] {
  const entries: Array<[BackgroundTaskKind, boolean]> = [
    ["automation_scan", preferences.automationScanEnabled],
    ["due_alerts", preferences.dueAlertsEnabled],
    ["financial_risk", preferences.financialRiskEnabled],
    ["goals_budget", preferences.goalsBudgetEnabled],
    ["monthly_closing", preferences.monthlyClosingEnabled],
    ["backup_reminder", preferences.backupReminderEnabled],
    ["weekly_summary", preferences.weeklySummaryEnabled],
  ];
  return entries.filter(([, enabled]) => enabled).map(([kind]) => kind);
}
