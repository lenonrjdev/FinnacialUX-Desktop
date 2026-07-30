import type { FinancialIntelligenceProjection } from "@/types/financial-intelligence";
import type { FinancialAccount } from "@/types/contas";
import type { FinancialDebt } from "@/types/dividas";
import type { FinancialTransaction } from "@/types/lancamentos";
import type { FinancialGoal, GoalPriority } from "@/types/metas";
import type { FinancialCategory, MonthlyBudget } from "@/types/orcamentos";

export type PlanningPeriod = "monthly" | "annual";
export type FinancialPlanStatus = "draft" | "active" | "archived";
export type DebtPlanningStrategy = "avalanche" | "snowball" | "priority";
export type PlanningAllocationKey = "essentials" | "lifestyle" | "debts" | "goals" | "reserve" | "flexible";
export type PlanningHealth = "healthy" | "attention" | "critical";
export type PlanningDecisionKind = "review" | "debt" | "goal" | "budget" | "reserve" | "commitment";
export type PlanningDecisionStatus = "pending" | "completed" | "dismissed";

export interface PlanningAllocationPercentages {
  essentials: number;
  lifestyle: number;
  debts: number;
  goals: number;
  reserve: number;
}

export interface FinancialPlanDraft {
  name: string;
  period: PlanningPeriod;
  startMonth: string;
  durationMonths: number;
  monthlyIncomeTarget: number;
  allocationPercentages: PlanningAllocationPercentages;
  debtStrategy: DebtPlanningStrategy;
  extraDebtPayment: number;
  reserveTargetMonths: number;
  categoryLimitAdjustmentPercent: number;
  goalPriorityOrder: string[];
}

export interface PlanningAllocationRow {
  key: PlanningAllocationKey;
  label: string;
  percentage: number;
  monthlyAmount: number;
  annualAmount: number;
  health: PlanningHealth;
  explanation: string;
}

export interface PlanningCategoryLimit {
  categoryId: string;
  categoryName: string;
  baselineAmount: number;
  currentBudget: number | null;
  plannedLimit: number;
  alertThreshold: number;
  deviationAmount: number;
  deviationPercent: number;
  health: PlanningHealth;
  explanation: string;
}

export interface DebtPlanProjection {
  debtId: string;
  name: string;
  strategyPosition: number;
  startingBalance: number;
  minimumPayment: number;
  extraPaymentApplied: number;
  projectedPayoffMonth: string | null;
  projectedMonths: number | null;
  projectedInterest: number;
  interestSavedEstimate: number;
  health: PlanningHealth;
  explanation: string;
}

export interface GoalPlanProjection {
  goalId: string;
  name: string;
  priority: GoalPriority;
  allocatedMonthlyAmount: number;
  requiredMonthlyAmount: number;
  projectedCompletionMonth: string | null;
  targetMonth: string;
  health: PlanningHealth;
  explanation: string;
}

export interface PlanningMonthlyPoint {
  month: string;
  label: string;
  plannedIncome: number;
  essentialLimit: number;
  lifestyleLimit: number;
  debtPayment: number;
  goalContribution: number;
  reserveContribution: number;
  flexibleAmount: number;
  plannedResult: number;
  projectedEndingBalance: number;
  health: PlanningHealth;
}

export interface PlanDeviation {
  id: string;
  scope: "income" | "expenses" | "category" | "debt" | "goal" | "reserve";
  label: string;
  plannedAmount: number;
  actualAmount: number;
  deviationAmount: number;
  deviationPercent: number;
  health: PlanningHealth;
  explanation: string;
}

export interface PlanningRecommendation {
  id: string;
  priority: "high" | "medium" | "low";
  title: string;
  message: string;
  action: string;
  impactAmount: number | null;
  explanation: string;
}

export interface PlanningDecision {
  id: string;
  workspaceId: string;
  planId: string | null;
  title: string;
  kind: PlanningDecisionKind;
  decisionDate: string;
  amount: number | null;
  status: PlanningDecisionStatus;
  notes: string;
  generated: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PlanningSimulationSummary {
  monthlyIncomeTarget: number;
  monthlyAllocated: number;
  monthlyFlexible: number;
  allocationRate: number;
  totalDebtBalance: number;
  projectedDebtFreeMonth: string | null;
  reserveCoverageMonths: number;
  projectedReserveCoverageMonths: number;
  activeGoals: number;
  onTrackGoals: number;
  health: PlanningHealth;
}

export interface FinancialPlanSimulation {
  generatedAt: string;
  sourceChecksum: string;
  projectionChecksum: string;
  draft: FinancialPlanDraft;
  summary: PlanningSimulationSummary;
  allocations: PlanningAllocationRow[];
  categoryLimits: PlanningCategoryLimit[];
  debtPlan: DebtPlanProjection[];
  goalPlan: GoalPlanProjection[];
  monthly: PlanningMonthlyPoint[];
  deviations: PlanDeviation[];
  recommendations: PlanningRecommendation[];
  decisions: Omit<PlanningDecision, "workspaceId" | "planId" | "createdAt" | "updatedAt">[];
  warnings: string[];
  canActivate: boolean;
  explanation: string[];
}

export interface FinancialPlanningInput {
  referenceDate: string;
  projection: FinancialIntelligenceProjection;
  draft: FinancialPlanDraft;
  monthlyReviewDay: number;
  accounts: FinancialAccount[];
  transactions: FinancialTransaction[];
  categories: FinancialCategory[];
  monthlyBudgets: MonthlyBudget[];
  debts: FinancialDebt[];
  goals: FinancialGoal[];
}

export interface PlanningPreferences {
  workspaceId: string;
  defaultPeriod: PlanningPeriod;
  defaultDebtStrategy: DebtPlanningStrategy;
  defaultReserveTargetMonths: number;
  monthlyReviewDay: number;
  requireSimulationBeforeActivation: boolean;
  updatedAt: string;
}

export interface SavePlanningPreferencesRequest {
  defaultPeriod: PlanningPeriod;
  defaultDebtStrategy: DebtPlanningStrategy;
  defaultReserveTargetMonths: number;
  monthlyReviewDay: number;
  requireSimulationBeforeActivation: boolean;
}

export interface SavedFinancialPlan {
  id: string;
  workspaceId: string;
  name: string;
  status: FinancialPlanStatus;
  period: PlanningPeriod;
  startMonth: string;
  endMonth: string;
  draft: FinancialPlanDraft;
  simulationSummary: PlanningSimulationSummary;
  sourceChecksum: string;
  projectionChecksum: string;
  createdAt: string;
  updatedAt: string;
  activatedAt: string | null;
  archivedAt: string | null;
}

export interface SaveFinancialPlanRequest {
  id?: string;
  draft: FinancialPlanDraft;
  simulation: FinancialPlanSimulation;
}

export interface ActivateFinancialPlanRequest {
  planId: string;
  sourceChecksum: string;
  projectionChecksum: string;
  decisions: FinancialPlanSimulation["decisions"];
}

export interface FinancialPlanReview {
  id: string;
  workspaceId: string;
  planId: string;
  reviewMonth: string;
  sourceChecksum: string;
  summary: PlanningSimulationSummary;
  deviations: PlanDeviation[];
  acceptedAdjustments: string[];
  notes: string;
  createdAt: string;
}

export interface RecordFinancialPlanReviewRequest {
  planId: string;
  reviewMonth: string;
  sourceChecksum: string;
  summary: PlanningSimulationSummary;
  deviations: PlanDeviation[];
  acceptedAdjustments: string[];
  notes: string;
}

export interface SavePlanningDecisionRequest {
  id?: string;
  planId?: string | null;
  title: string;
  kind: PlanningDecisionKind;
  decisionDate: string;
  amount?: number | null;
  status?: PlanningDecisionStatus;
  notes?: string;
  generated?: boolean;
}

export const defaultPlanningDraft: FinancialPlanDraft = {
  name: "Meu plano financeiro",
  period: "monthly",
  startMonth: new Date().toISOString().slice(0, 7),
  durationMonths: 12,
  monthlyIncomeTarget: 0,
  allocationPercentages: {
    essentials: 50,
    lifestyle: 20,
    debts: 10,
    goals: 10,
    reserve: 10,
  },
  debtStrategy: "avalanche",
  extraDebtPayment: 0,
  reserveTargetMonths: 6,
  categoryLimitAdjustmentPercent: 0,
  goalPriorityOrder: [],
};
