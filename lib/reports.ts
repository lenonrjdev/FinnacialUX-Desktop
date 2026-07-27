import type {
  MonthlyFinancialSnapshot,
  ProjectionMonth,
  ProjectionScenarioSettings,
  ReportPeriod,
} from "@/types/relatorios";

const monthNames = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

const shortMonthNames = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

export function selectSnapshots(
  snapshots: MonthlyFinancialSnapshot[],
  period: ReportPeriod,
): MonthlyFinancialSnapshot[] {
  const latestYear = snapshots.at(-1)?.month.slice(0, 4);
  const currentYear = latestYear ? snapshots.filter((item) => item.month.startsWith(`${latestYear}-`)) : [];
  if (period === "current-month") return snapshots.slice(-1);
  if (period === "last-3-months") return snapshots.slice(-3);
  if (period === "last-6-months") return snapshots.slice(-6);
  return currentYear;
}

export function addMonths(monthKey: string, amount: number): string {
  const [year, month] = monthKey.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1 + amount, 1, 12));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function monthLabel(monthKey: string): { label: string; shortLabel: string } {
  const [year, month] = monthKey.split("-").map(Number);
  return {
    label: `${monthNames[month - 1]} de ${year}`,
    shortLabel: shortMonthNames[month - 1],
  };
}

export function calculateDebtExpense(
  monthIndex: number,
  debts: Array<{ installmentAmount: number; totalInstallments: number; paidInstallments: number; currentBalance: number; status: string }>,
): number {
  return debts.reduce((total, debt) => {
    if (debt.status === "paid") return total;
    const remainingInstallments = Math.max(debt.totalInstallments - debt.paidInstallments, 0);
    if (monthIndex >= remainingInstallments) return total;
    return total + Math.min(debt.installmentAmount, debt.currentBalance);
  }, 0);
}

export function calculateInstallmentExpense(
  monthIndex: number,
  plans: Array<{ installmentAmount: number; paidInstallments: number; totalInstallments: number }>,
): number {
  return plans.reduce((total, plan) => {
    const remainingInstallments = Math.max(plan.totalInstallments - plan.paidInstallments, 0);
    return monthIndex < remainingInstallments ? total + plan.installmentAmount : total;
  }, 0);
}

export function buildProjection({
  startMonth,
  startingBalance,
  averageIncome,
  essentialExpenses,
  subscriptionExpenses,
  goals,
  variableExpenses,
  debts,
  installments,
  scenario,
}: {
  startMonth: string;
  startingBalance: number;
  averageIncome: number;
  essentialExpenses: number;
  subscriptionExpenses: number;
  goals: number;
  variableExpenses: number;
  debts: Array<{ installmentAmount: number; totalInstallments: number; paidInstallments: number; currentBalance: number; status: string }>;
  installments: Array<{ installmentAmount: number; paidInstallments: number; totalInstallments: number }>;
  scenario: ProjectionScenarioSettings;
}): ProjectionMonth[] {
  let balance = startingBalance;

  return Array.from({ length: 12 }, (_, index) => {
    const month = addMonths(startMonth, index + 1);
    const labels = monthLabel(month);
    const income = averageIncome * scenario.incomeFactor;
    const debtExpense = calculateDebtExpense(index, debts) * scenario.expenseFactor;
    const installmentExpense = calculateInstallmentExpense(index, installments) * scenario.expenseFactor;
    const adjustedEssential = essentialExpenses * scenario.expenseFactor;
    const adjustedSubscriptions = subscriptionExpenses * scenario.expenseFactor;
    const adjustedGoals = goals * scenario.expenseFactor;
    const adjustedVariable = variableExpenses * scenario.expenseFactor;
    const totalExpenses = adjustedEssential
      + adjustedSubscriptions
      + debtExpense
      + installmentExpense
      + adjustedGoals
      + adjustedVariable;
    const monthlyResult = income - totalExpenses;
    balance += monthlyResult;

    return {
      month,
      ...labels,
      income,
      essentialExpenses: adjustedEssential,
      subscriptions: adjustedSubscriptions,
      debts: debtExpense,
      installments: installmentExpense,
      goals: adjustedGoals,
      variableExpenses: adjustedVariable,
      totalExpenses,
      monthlyResult,
      projectedBalance: balance,
    };
  });
}
