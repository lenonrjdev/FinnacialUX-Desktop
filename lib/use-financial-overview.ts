"use client";

import { useMemo } from "react";
import { useFinanceDataState } from "@/components/providers/finance-data-provider";
import { initialGoals } from "@/data/metas";
import { initialMonthlyBudgets } from "@/data/orcamentos";
import { endOfMonth } from "@/lib/financial-intelligence";
import { getReferenceDate, getReferenceMonth } from "@/lib/reference-date";
import { useFinancialIntelligence } from "@/lib/use-financial-intelligence";
import type { FinancialTransaction } from "@/types/lancamentos";
import type { FinancialGoal } from "@/types/metas";
import type { MonthlyBudget } from "@/types/orcamentos";
import type { OverviewIconName, SummaryCardId, SummaryTone, TransactionKind } from "@/types/overview";

type SummaryDatum = {
  value: number;
  helper: string;
  trend: string;
  tone: SummaryTone;
};

export type FinancialOverviewData = {
  currentMonth: string;
  availableAfterCommitments: number;
  hasFinancialData: boolean;
  summaryCards: Record<SummaryCardId, SummaryDatum>;
  cashFlowSummary: { income: number; expense: number; result: number };
  cashFlowChart: Array<{ month: string; income: number; expense: number }>;
  monthlyPanel: {
    balance: number;
    retainedPercentage: number;
    budgetUsed: number;
    budgetUsedPercentage: number;
    budgetAvailable: number;
    goal: { name: string; current: number; target: number; percentage: number };
  };
  bills: Array<{ id: string; title: string; date: string; value: number; status: string }>;
  transactions: Array<{
    id: string;
    title: string;
    category: string;
    date: string;
    value: number;
    icon: OverviewIconName;
    kind: TransactionKind;
  }>;
};

const monthFormatter = new Intl.DateTimeFormat("pt-BR", {
  month: "long",
  timeZone: "America/Sao_Paulo",
});
const shortMonthFormatter = new Intl.DateTimeFormat("pt-BR", {
  month: "short",
  timeZone: "UTC",
});
const shortDateFormatter = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "short",
  timeZone: "UTC",
});

function monthKeys(referenceMonth: string, count: number): string[] {
  const [year, month] = referenceMonth.split("-").map(Number);
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(Date.UTC(year, month - count + index, 1, 12));
    return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
  });
}

function daysUntil(date: string, referenceDate: string): number {
  return Math.ceil(
    (new Date(`${date}T12:00:00Z`).getTime() - new Date(`${referenceDate}T12:00:00Z`).getTime()) / 86400000,
  );
}

function transactionIcon(transaction: FinancialTransaction): OverviewIconName {
  if (transaction.type === "income") return "income";
  const category = transaction.category.toLocaleLowerCase("pt-BR");
  if (category.includes("cartão") || category.includes("cartao")) return "credit-card";
  if (category.includes("compra") || category.includes("aliment")) return "shopping";
  return "transactions";
}

export function useFinancialOverviewData(): FinancialOverviewData {
  const {
    accounts,
    transactions,
    unifiedPayables,
    cards,
    receivables,
    subscriptions,
    debts,
  } = useFinancialIntelligence();
  const [budgets] = useFinanceDataState<MonthlyBudget[]>("monthly-budgets", initialMonthlyBudgets);
  const [goals] = useFinanceDataState<FinancialGoal[]>("goals", initialGoals);

  return useMemo(() => {
    const referenceDate = getReferenceDate();
    const referenceMonth = getReferenceMonth();
    const currentMonth = monthFormatter.format(new Date(`${referenceDate}T12:00:00`));
    const completedCurrent = transactions.filter(
      (transaction) => transaction.status === "completed" && transaction.date.startsWith(referenceMonth),
    );
    const income = completedCurrent
      .filter((transaction) => transaction.type === "income")
      .reduce((total, transaction) => total + transaction.amount, 0);
    const expense = completedCurrent
      .filter((transaction) => transaction.type === "expense")
      .reduce((total, transaction) => total + transaction.amount, 0);
    const result = income - expense;
    const includedAccounts = accounts.filter((account) => account.includeInTotal);
    const totalBalance = includedAccounts.reduce((total, account) => total + account.balance, 0);
    const commitmentLimit = endOfMonth(referenceDate);
    const pendingPayables = unifiedPayables.filter((payable) => (
      payable.status !== "paid" && payable.dueDate <= commitmentLimit
    ));
    const pendingTotal = pendingPayables.reduce(
      (total, payable) => total + Math.max(payable.amount - payable.paidAmount, 0),
      0,
    );
    const availableAfterCommitments = totalBalance - pendingTotal;
    const currentBudgets = budgets.filter((budget) => budget.month === referenceMonth);
    const budgetPlanned = currentBudgets.reduce((total, budget) => total + budget.limit, 0);
    const budgetUsed = expense;
    const budgetUsedPercentage = budgetPlanned > 0 ? Math.min((budgetUsed / budgetPlanned) * 100, 100) : 0;
    const primaryGoal = goals.find((goal) => goal.status === "active") ?? goals[0];
    const chartMonths = monthKeys(referenceMonth, 6);
    const absoluteChart = chartMonths.map((month) => {
      const monthTransactions = transactions.filter(
        (transaction) => transaction.status === "completed" && transaction.date.startsWith(month),
      );
      return {
        month,
        income: monthTransactions
          .filter((transaction) => transaction.type === "income")
          .reduce((total, transaction) => total + transaction.amount, 0),
        expense: monthTransactions
          .filter((transaction) => transaction.type === "expense")
          .reduce((total, transaction) => total + transaction.amount, 0),
      };
    });
    const chartMaximum = Math.max(1, ...absoluteChart.flatMap((item) => [item.income, item.expense]));
    const completedTransactions = transactions
      .filter((transaction) => transaction.status === "completed" && transaction.type !== "transfer")
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 3);
    const hasFinancialData = accounts.length > 0
      || transactions.length > 0
      || unifiedPayables.length > 0
      || cards.length > 0
      || receivables.length > 0
      || subscriptions.length > 0
      || debts.length > 0
      || budgets.length > 0
      || goals.length > 0;

    return {
      currentMonth,
      availableAfterCommitments,
      hasFinancialData,
      summaryCards: {
        balance: {
          value: totalBalance,
          helper: accounts.length ? `${accounts.length} ${accounts.length === 1 ? "conta cadastrada" : "contas cadastradas"}` : "Nenhuma conta cadastrada",
          trend: accounts.length ? "Saldo calculado pelo banco" : "Cadastre sua primeira conta",
          tone: "neutral",
        },
        income: {
          value: income,
          helper: `${completedCurrent.filter((transaction) => transaction.type === "income").length} recebimentos`,
          trend: income > 0 ? "Receitas registradas no mês" : "Nenhuma receita registrada",
          tone: income > 0 ? "positive" : "neutral",
        },
        expenses: {
          value: expense,
          helper: `${completedCurrent.filter((transaction) => transaction.type === "expense").length} lançamentos`,
          trend: income > 0 ? `${((expense / income) * 100).toFixed(1).replace(".", ",")}% das receitas` : "Nenhuma despesa registrada",
          tone: "neutral",
        },
        pending: {
          value: pendingTotal,
          helper: `${pendingPayables.length} ${pendingPayables.length === 1 ? "conta pendente" : "contas pendentes"}`,
          trend: pendingPayables.length ? "Compromissos ainda não pagos" : "Nenhuma conta pendente",
          tone: pendingPayables.length ? "warning" : "neutral",
        },
      },
      cashFlowSummary: { income, expense, result },
      cashFlowChart: absoluteChart.map((item) => ({
        month: shortMonthFormatter.format(new Date(`${item.month}-01T12:00:00Z`)).replace(".", ""),
        income: item.income > 0 ? Math.max((item.income / chartMaximum) * 100, 3) : 0,
        expense: item.expense > 0 ? Math.max((item.expense / chartMaximum) * 100, 3) : 0,
      })),
      monthlyPanel: {
        balance: result,
        retainedPercentage: income > 0 ? (result / income) * 100 : 0,
        budgetUsed,
        budgetUsedPercentage,
        budgetAvailable: Math.max(budgetPlanned - budgetUsed, 0),
        goal: primaryGoal
          ? {
              name: primaryGoal.name,
              current: primaryGoal.currentAmount,
              target: primaryGoal.targetAmount,
              percentage: primaryGoal.targetAmount > 0
                ? Math.min((primaryGoal.currentAmount / primaryGoal.targetAmount) * 100, 100)
                : 0,
            }
          : { name: "Nenhuma meta cadastrada", current: 0, target: 0, percentage: 0 },
      },
      bills: pendingPayables
        .slice()
        .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
        .slice(0, 3)
        .map((payable) => {
          const remainingDays = daysUntil(payable.dueDate, referenceDate);
          const status = remainingDays < 0
            ? `${Math.abs(remainingDays)} ${Math.abs(remainingDays) === 1 ? "dia em atraso" : "dias em atraso"}`
            : remainingDays === 0
              ? "Vence hoje"
              : `Em ${remainingDays} ${remainingDays === 1 ? "dia" : "dias"}`;
          return {
            id: payable.id,
            title: payable.description,
            date: shortDateFormatter.format(new Date(`${payable.dueDate}T12:00:00Z`)).replace(".", ""),
            value: Math.max(payable.amount - payable.paidAmount, 0),
            status,
          };
        }),
      transactions: completedTransactions.map((transaction) => ({
        id: transaction.id,
        title: transaction.description,
        category: transaction.category,
        date: shortDateFormatter.format(new Date(`${transaction.date}T12:00:00Z`)).replace(".", ""),
        value: transaction.type === "expense" ? -transaction.amount : transaction.amount,
        icon: transactionIcon(transaction),
        kind: transaction.type as TransactionKind,
      })),
    };
  }, [accounts, budgets, cards, debts, goals, receivables, subscriptions, transactions, unifiedPayables]);
}
