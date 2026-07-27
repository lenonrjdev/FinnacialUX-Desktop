import { getReferenceDate } from "@/lib/reference-date";
import type { FinancialGoal, GoalContribution } from "@/types/metas";

export const goalsReferenceDate = getReferenceDate();
export const essentialMonthlyCost = 0;
export const emergencyCoverageTarget = 6;
export const initialGoals: FinancialGoal[] = [];
export const initialGoalContributions: GoalContribution[] = [];
