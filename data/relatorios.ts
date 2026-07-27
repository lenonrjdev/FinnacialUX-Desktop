import { getReferenceDate, getReferenceMonth } from "@/lib/reference-date";
import type {
  MonthlyFinancialSnapshot,
  ProjectionScenario,
  ProjectionScenarioSettings,
} from "@/types/relatorios";

export const reportsReferenceDate = getReferenceDate();
export const reportsReferenceMonth = getReferenceMonth();
export const monthlyFinancialHistory: MonthlyFinancialSnapshot[] = [];
export const projectionScenarioSettings: Record<ProjectionScenario, ProjectionScenarioSettings> = {
  conservative: { incomeFactor: 0.9, expenseFactor: 1.1 },
  realistic: { incomeFactor: 1, expenseFactor: 1 },
  optimistic: { incomeFactor: 1.1, expenseFactor: 0.95 },
};
export const projectionVariableExpenseBaseline = 0;
