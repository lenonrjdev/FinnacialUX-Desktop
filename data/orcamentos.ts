import { getReferenceDate } from "@/lib/reference-date";
import type { FinancialCategory, MonthlyBudget } from "@/types/orcamentos";

export const budgetReferenceDate = getReferenceDate();
export const initialCategories: FinancialCategory[] = [];
export const initialMonthlyBudgets: MonthlyBudget[] = [];
