export type GoalKind = "goal" | "reserve";
export type GoalStatus = "active" | "paused" | "completed";
export type GoalPriority = "high" | "medium" | "low";
export type GoalCategory =
  | "emergency"
  | "travel"
  | "purchase"
  | "home"
  | "education"
  | "debt"
  | "other";
export type GoalTone = "graphite" | "sage" | "sand" | "violet" | "rose" | "blue";
export type GoalFilter = "all" | GoalKind;
export type GoalStatusFilter = "all" | GoalStatus;
export type GoalView = "goals" | "movements";
export type ContributionType = "deposit" | "withdrawal";

export type FinancialGoal = {
  id: string;
  name: string;
  description: string;
  kind: GoalKind;
  category: GoalCategory;
  tone: GoalTone;
  targetAmount: number;
  currentAmount: number;
  monthlyContribution: number;
  targetDate: string;
  accountId: string;
  priority: GoalPriority;
  status: GoalStatus;
  createdAt: string;
};

export type GoalContribution = {
  id: string;
  goalId: string;
  accountId: string;
  type: ContributionType;
  amount: number;
  date: string;
  note: string;
};

export type GoalComputedStatus = "on-track" | "attention" | "completed" | "paused";

export type GoalRow = FinancialGoal & {
  progress: number;
  remaining: number;
  monthsRemaining: number;
  requiredMonthly: number;
  computedStatus: GoalComputedStatus;
};

export type GoalFormInput = {
  name: string;
  description: string;
  kind: GoalKind;
  category: GoalCategory;
  tone: GoalTone;
  targetAmount: number;
  currentAmount: number;
  monthlyContribution: number;
  targetDate: string;
  accountId: string;
  priority: GoalPriority;
};

export type ContributionFormInput = {
  goalId: string;
  accountId: string;
  type: ContributionType;
  amount: number;
  date: string;
  note: string;
};
