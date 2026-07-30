import type {
  AutomationCandidate,
  AutomationFrequency,
  AutomationPreviewSummary,
  AutomationRun,
  RecurringTransactionTemplate,
} from "@/types/desktop-automations";

function parseDate(value: string): Date {
  const date = new Date(`${value}T12:00:00Z`);
  if (Number.isNaN(date.getTime())) throw new Error("Data de automação inválida.");
  return date;
}

function toDateOnly(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function addMonthsClamped(date: Date, months: number): void {
  const originalDay = date.getUTCDate();
  date.setUTCDate(1);
  date.setUTCMonth(date.getUTCMonth() + months);
  const lastDay = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0, 12)).getUTCDate();
  date.setUTCDate(Math.min(originalDay, lastDay));
}

export function advanceAutomationDate(
  value: string,
  frequency: AutomationFrequency,
  interval = 1,
): string {
  const date = parseDate(value);
  const safeInterval = Math.max(1, Math.trunc(interval));
  if (frequency === "weekly") date.setUTCDate(date.getUTCDate() + (7 * safeInterval));
  if (frequency === "monthly") addMonthsClamped(date, safeInterval);
  if (frequency === "quarterly") addMonthsClamped(date, 3 * safeInterval);
  if (frequency === "yearly") addMonthsClamped(date, 12 * safeInterval);
  return toDateOnly(date);
}

export function buildDueOccurrenceDates(
  template: Pick<RecurringTransactionTemplate, "active" | "frequency" | "interval" | "nextRunAt">,
  referenceDate: string,
  limit = 12,
): string[] {
  if (!template.active) return [];
  const dates: string[] = [];
  let cursor = template.nextRunAt;
  while (cursor <= referenceDate && dates.length < Math.max(1, limit)) {
    dates.push(cursor);
    cursor = advanceAutomationDate(cursor, template.frequency, template.interval);
  }
  return dates;
}

export function summarizeAutomationCandidates(
  candidates: AutomationCandidate[],
  alerts = 0,
): AutomationPreviewSummary {
  const ruleChanges = candidates.filter((candidate) => candidate.kind === "rule").length;
  const learnedSuggestions = candidates.filter((candidate) => candidate.kind === "suggestion").length;
  const recurringTransactions = candidates.filter((candidate) => candidate.kind === "recurrence").length;
  return {
    ruleChanges,
    learnedSuggestions,
    recurringTransactions,
    alerts,
    totalCandidates: candidates.length,
  };
}

export function canUndoAutomationRun(run: AutomationRun): boolean {
  return run.status === "applied" && run.reversible && !run.undoneAt;
}

export function automationFrequencyLabel(frequency: AutomationFrequency): string {
  return {
    weekly: "Semanal",
    monthly: "Mensal",
    quarterly: "Trimestral",
    yearly: "Anual",
  }[frequency];
}
