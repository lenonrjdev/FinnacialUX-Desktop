export type BudgetStatusFilter = "all" | "healthy" | "attention" | "exceeded";
export type BudgetView = "budgets" | "categories";
export type CategoryType = "expense" | "income";
export type CategoryTone = "graphite" | "sage" | "sand" | "violet" | "rose" | "blue";

export type FinancialCategory = {
  id: string;
  name: string;
  type: CategoryType;
  description: string;
  tone: CategoryTone;
  active: boolean;
  isDefault: boolean;
};

export type MonthlyBudget = {
  id: string;
  categoryId: string;
  month: string;
  limit: number;
  alertThreshold: number;
};

export type BudgetRow = MonthlyBudget & {
  category: FinancialCategory;
  spent: number;
  available: number;
  usage: number;
  status: Exclude<BudgetStatusFilter, "all">;
};

export type BudgetFormInput = {
  categoryId: string;
  limit: number;
  alertThreshold: number;
};

export type CategoryFormInput = {
  name: string;
  type: CategoryType;
  description: string;
  tone: CategoryTone;
};
