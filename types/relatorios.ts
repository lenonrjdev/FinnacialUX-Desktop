export type ReportView = "reports" | "projection";

export type ReportPeriod =
  | "current-month"
  | "last-3-months"
  | "last-6-months"
  | "year";

export type ProjectionScenario = "conservative" | "realistic" | "optimistic";

export type FinancialTrend = "up" | "down" | "stable";

export interface MonthlyFinancialSnapshot {
  month: string;
  label: string;
  shortLabel: string;
  income: number;
  expenses: number;
}

export interface CategoryReportRow {
  category: string;
  amount: number;
  percentage: number;
}

export interface BudgetReportRow {
  category: string;
  planned: number;
  actual: number;
  difference: number;
  usage: number;
  status: "healthy" | "attention" | "exceeded";
}

export interface AccountReportRow {
  id: string;
  name: string;
  institution: string;
  balance: number;
  percentage: number;
}

export interface ProjectionScenarioSettings {
  incomeFactor: number;
  expenseFactor: number;
}

export interface ProjectionMonth {
  month: string;
  label: string;
  shortLabel: string;
  income: number;
  essentialExpenses: number;
  subscriptions: number;
  debts: number;
  installments: number;
  goals: number;
  variableExpenses: number;
  totalExpenses: number;
  monthlyResult: number;
  projectedBalance: number;
}

export interface ProjectionCommitmentSummary {
  essentialExpenses: number;
  subscriptions: number;
  debts: number;
  installments: number;
  goals: number;
  variableExpenses: number;
}

export interface FinancialHealthItem {
  id: string;
  label: string;
  value: string;
  helper: string;
  status: "positive" | "attention" | "critical" | "neutral";
}
