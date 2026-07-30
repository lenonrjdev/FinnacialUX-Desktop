import type { PersonalSubscription } from "@/types/assinaturas";
import type { InstallmentPlan } from "@/types/cartoes";
import type { FinancialCalendarEvent } from "@/types/calendario";
import type { Payable } from "@/types/contas-a-pagar";
import type { FinancialAccount } from "@/types/contas";
import type { FinancialDebt } from "@/types/dividas";
import type { FinancialTransaction } from "@/types/lancamentos";
import type { FinancialGoal } from "@/types/metas";
import type { Receivable } from "@/types/recebimentos";

export type CommitmentSource =
  | "manual-payable"
  | "card-invoice"
  | "subscription"
  | "debt-installment";

export type UnifiedPayable = Payable & {
  sourceType: CommitmentSource;
  sourceRecordId: string;
  sourceLabel: string;
  occurrenceDate: string;
  generated: boolean;
};

export type UnifiedCalendarEvent = FinancialCalendarEvent & {
  sourceType?: CommitmentSource | "receivable" | "manual";
  sourceRecordId?: string;
  sourceLabel?: string;
  generated?: boolean;
};

export type IntelligenceScenario = "conservative" | "expected" | "optimistic";
export type ProjectionHorizonDays = 30 | 60 | 90 | 365;
export type AnomalySensitivity = "low" | "balanced" | "high";
export type IntelligenceRiskSeverity = "info" | "attention" | "critical";
export type IntelligenceEventKind =
  | "historical-income"
  | "historical-variable-expense"
  | "transaction"
  | "payable"
  | "receivable"
  | "subscription"
  | "debt"
  | "installment"
  | "goal"
  | "simulated-income"
  | "simulated-expense"
  | "simulated-commitment";

export interface IntelligencePreferences {
  workspaceId: string;
  defaultHorizonDays: ProjectionHorizonDays;
  defaultScenario: IntelligenceScenario;
  anomalySensitivity: AnomalySensitivity;
  negativeBalanceThreshold: number;
  includeGoalContributions: boolean;
  updatedAt: string;
}

export interface IntelligenceScenarioAssumptions {
  incomeAdjustmentPercent: number;
  fixedExpenseAdjustmentPercent: number;
  variableExpenseAdjustmentPercent: number;
  oneTimeIncome: number;
  oneTimeIncomeDate: string | null;
  oneTimeExpense: number;
  oneTimeExpenseDate: string | null;
  newMonthlyCommitment: number;
  newCommitmentStartDate: string | null;
  newCommitmentMonths: number;
}

export interface SavedIntelligenceScenario {
  id: string;
  workspaceId: string;
  name: string;
  scenarioType: IntelligenceScenario;
  horizonDays: ProjectionHorizonDays;
  assumptions: IntelligenceScenarioAssumptions;
  createdAt: string;
  updatedAt: string;
}

export interface IntelligenceSnapshotSummary {
  id: string;
  workspaceId: string;
  referenceDate: string;
  horizonDays: ProjectionHorizonDays;
  scenarioType: IntelligenceScenario;
  sourceChecksum: string;
  endingBalance: number;
  lowestBalance: number;
  firstNegativeDate: string | null;
  createdAt: string;
}

export interface IntelligenceProjectionEvent {
  id: string;
  date: string;
  kind: IntelligenceEventKind;
  label: string;
  amount: number;
  direction: "income" | "expense";
  sourceId: string | null;
  confidence: number;
  explanation: string;
}

export interface IntelligenceDailyPoint {
  date: string;
  expectedIncome: number;
  expectedExpenses: number;
  netChange: number;
  projectedBalance: number;
  confidence: number;
  events: IntelligenceProjectionEvent[];
}

export interface IntelligenceMonthlyPoint {
  month: string;
  label: string;
  shortLabel: string;
  expectedIncome: number;
  expectedExpenses: number;
  netChange: number;
  endingBalance: number;
  lowestBalance: number;
  confidence: number;
}

export interface IntelligenceRisk {
  id: string;
  severity: IntelligenceRiskSeverity;
  title: string;
  message: string;
  date: string | null;
  value: number | null;
  recommendation: string;
  explanation: string;
}

export interface SpendingAnomaly {
  id: string;
  category: string;
  currentAmount: number;
  baselineAmount: number;
  deviationPercent: number;
  severity: IntelligenceRiskSeverity;
  explanation: string;
}

export interface GoalForecast {
  goalId: string;
  name: string;
  targetDate: string;
  projectedCompletionDate: string | null;
  remainingAmount: number;
  requiredMonthlyContribution: number;
  plannedMonthlyContribution: number;
  status: "on-track" | "attention" | "unreachable" | "completed";
  explanation: string;
}

export interface ActualVsExpected {
  month: string;
  expectedIncome: number;
  actualIncome: number;
  incomeVariance: number;
  expectedExpenses: number;
  actualExpenses: number;
  expenseVariance: number;
  expectedResult: number;
  actualResult: number;
}

export interface IntelligenceProjectionSummary {
  startingBalance: number;
  endingBalance: number;
  lowestBalance: number;
  totalIncome: number;
  totalExpenses: number;
  projectedResult: number;
  firstNegativeDate: string | null;
  fixedCommitmentRate: number;
  reserveCoverageMonths: number;
  confidence: number;
}

export interface FinancialIntelligenceProjection {
  referenceDate: string;
  horizonDays: ProjectionHorizonDays;
  scenario: IntelligenceScenario;
  sourceChecksum: string;
  generatedAt: string;
  daily: IntelligenceDailyPoint[];
  monthly: IntelligenceMonthlyPoint[];
  summary: IntelligenceProjectionSummary;
  risks: IntelligenceRisk[];
  anomalies: SpendingAnomaly[];
  goals: GoalForecast[];
  actualVsExpected: ActualVsExpected;
  explanation: string[];
}

export interface FinancialIntelligenceInput {
  referenceDate: string;
  horizonDays: ProjectionHorizonDays;
  scenario: IntelligenceScenario;
  assumptions: IntelligenceScenarioAssumptions;
  anomalySensitivity: AnomalySensitivity;
  negativeBalanceThreshold: number;
  includeGoalContributions: boolean;
  accounts: FinancialAccount[];
  transactions: FinancialTransaction[];
  payables: Payable[];
  receivables: Receivable[];
  subscriptions: PersonalSubscription[];
  debts: FinancialDebt[];
  installmentPlans: InstallmentPlan[];
  goals: FinancialGoal[];
}

export interface SaveIntelligencePreferencesRequest {
  defaultHorizonDays: ProjectionHorizonDays;
  defaultScenario: IntelligenceScenario;
  anomalySensitivity: AnomalySensitivity;
  negativeBalanceThreshold: number;
  includeGoalContributions: boolean;
}

export interface SaveIntelligenceScenarioRequest {
  id?: string;
  name: string;
  scenarioType: IntelligenceScenario;
  horizonDays: ProjectionHorizonDays;
  assumptions: IntelligenceScenarioAssumptions;
}

export interface RecordIntelligenceSnapshotRequest {
  referenceDate: string;
  horizonDays: ProjectionHorizonDays;
  scenarioType: IntelligenceScenario;
  sourceChecksum: string;
  summary: IntelligenceProjectionSummary;
}

export const defaultIntelligenceAssumptions: IntelligenceScenarioAssumptions = {
  incomeAdjustmentPercent: 0,
  fixedExpenseAdjustmentPercent: 0,
  variableExpenseAdjustmentPercent: 0,
  oneTimeIncome: 0,
  oneTimeIncomeDate: null,
  oneTimeExpense: 0,
  oneTimeExpenseDate: null,
  newMonthlyCommitment: 0,
  newCommitmentStartDate: null,
  newCommitmentMonths: 12,
};
