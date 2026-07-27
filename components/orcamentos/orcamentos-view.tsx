"use client";

import { useMemo, useState } from "react";
import { BudgetCategoryList } from "@/components/orcamentos/budget-category-list";
import { BudgetDialog } from "@/components/orcamentos/budget-dialog";
import { BudgetInsightPanel } from "@/components/orcamentos/budget-insight-panel";
import { BudgetsHeading } from "@/components/orcamentos/budgets-heading";
import { BudgetsSummary } from "@/components/orcamentos/budgets-summary";
import { BudgetsToolbar } from "@/components/orcamentos/budgets-toolbar";
import { CategoriesManager } from "@/components/orcamentos/categories-manager";
import { CategoryDialog } from "@/components/orcamentos/category-dialog";
import { CheckIcon } from "@/components/shared/icons";
import { useFinanceDataState } from "@/components/providers/finance-data-provider";
import { budgetsContent } from "@/content/orcamentos";
import {
  budgetReferenceDate,
  initialCategories,
  initialMonthlyBudgets,
} from "@/data/orcamentos";
import { transactionsData } from "@/data/lancamentos";
import { matchesSearch } from "@/lib/search";
import type {
  BudgetFormInput,
  BudgetRow,
  BudgetStatusFilter,
  BudgetView,
  CategoryFormInput,
  FinancialCategory,
  MonthlyBudget,
} from "@/types/orcamentos";

function slugify(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function shiftMonth(monthKey: string, offset: number): string {
  const [year, month] = monthKey.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1 + offset, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function getMonthElapsed(monthKey: string): number {
  const referenceMonth = budgetReferenceDate.slice(0, 7);
  if (monthKey < referenceMonth) return 100;
  if (monthKey > referenceMonth) return 0;
  const [year, month, day] = budgetReferenceDate.split("-").map(Number);
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return (day / daysInMonth) * 100;
}

function resolveStatus(usage: number, threshold: number): BudgetRow["status"] {
  if (usage > 100) return "exceeded";
  if (usage >= threshold) return "attention";
  return "healthy";
}

export default function OrcamentosView() {
  const referenceMonth = budgetReferenceDate.slice(0, 7);
  const [categories, setCategories] = useFinanceDataState<FinancialCategory[]>("categories", initialCategories);
  const [budgets, setBudgets] = useFinanceDataState<MonthlyBudget[]>("monthly-budgets", initialMonthlyBudgets);
  const [transactions] = useFinanceDataState("transactions", transactionsData);
  const [monthKey, setMonthKey] = useState(referenceMonth);
  const [view, setView] = useState<BudgetView>("budgets");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<BudgetStatusFilter>("all");
  const [editingBudget, setEditingBudget] = useState<BudgetRow | null>(null);
  const [budgetDialogOpen, setBudgetDialogOpen] = useState(false);
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
  const [feedback, setFeedback] = useState("");

  const spentByCategory = useMemo(() => {
    const totals = new Map<string, number>();
    transactions
      .filter((transaction) => transaction.type === "expense" && transaction.status === "completed" && transaction.date.startsWith(monthKey))
      .forEach((transaction) => {
        const category = categories.find((item) => slugify(item.name) === slugify(transaction.category));
        if (!category) return;
        totals.set(category.id, (totals.get(category.id) ?? 0) + transaction.amount);
      });
    return totals;
  }, [categories, monthKey, transactions]);

  const rows = useMemo<BudgetRow[]>(() => budgets
    .filter((budget) => budget.month === monthKey)
    .map((budget) => {
      const category = categories.find((item) => item.id === budget.categoryId);
      if (!category) return null;
      const spent = spentByCategory.get(category.id) ?? 0;
      const usage = budget.limit > 0 ? (spent / budget.limit) * 100 : 0;
      return {
        ...budget,
        category,
        spent,
        available: budget.limit - spent,
        usage,
        status: resolveStatus(usage, budget.alertThreshold),
      };
    })
    .filter((row): row is BudgetRow => Boolean(row))
    .sort((a, b) => b.usage - a.usage), [budgets, categories, monthKey, spentByCategory]);

  const filteredRows = useMemo(() => rows.filter((row) => {
    const matchesQuery = matchesSearch(search, [
      row.category.name,
      row.category.description,
      row.limit,
      row.spent,
      row.available,
      row.usage,
      budgetsContent.status[row.status],
      row.category.type,
      row.category.active ? budgetsContent.categories.active : budgetsContent.categories.inactive,
    ]);
    const matchesStatus = status === "all" || row.status === status;
    return matchesQuery && matchesStatus;
  }), [rows, search, status]);

  const summary = useMemo(() => {
    const planned = rows.reduce((total, row) => total + row.limit, 0);
    const spent = rows.reduce((total, row) => total + row.spent, 0);
    return {
      planned,
      spent,
      available: planned - spent,
      usage: planned > 0 ? (spent / planned) * 100 : 0,
      attentionCount: rows.filter((row) => row.status !== "healthy").length,
    };
  }, [rows]);

  const monthElapsed = getMonthElapsed(monthKey);
  const projected = monthElapsed > 0 && monthElapsed < 100
    ? summary.spent / (monthElapsed / 100)
    : summary.spent;

  function showFeedback(message: string) {
    setFeedback(message);
    window.setTimeout(() => setFeedback(""), 2600);
  }

  function openNewBudget() {
    setEditingBudget(null);
    setBudgetDialogOpen(true);
  }

  function submitBudget(input: BudgetFormInput) {
    if (editingBudget) {
      setBudgets((current) => current.map((budget) => budget.id === editingBudget.id ? { ...budget, limit: input.limit, alertThreshold: input.alertThreshold } : budget));
      showFeedback(budgetsContent.budgetDialog.successEdit);
    } else {
      setBudgets((current) => [...current, {
        id: `budget-${input.categoryId}-${monthKey}-${Date.now()}`,
        categoryId: input.categoryId,
        month: monthKey,
        limit: input.limit,
        alertThreshold: input.alertThreshold,
      }]);
      showFeedback(budgetsContent.budgetDialog.successCreate);
    }
    setBudgetDialogOpen(false);
    setEditingBudget(null);
  }

  function submitCategory(input: CategoryFormInput) {
    const nextCategory: FinancialCategory = {
      id: `${slugify(input.name)}-${Date.now()}`,
      ...input,
      active: true,
      isDefault: false,
    };
    setCategories((current) => [...current, nextCategory]);
    setCategoryDialogOpen(false);
    showFeedback(budgetsContent.categoryDialog.success);
  }

  function toggleCategory(categoryId: string) {
    let nextActive = true;
    setCategories((current) => current.map((category) => {
      if (category.id !== categoryId) return category;
      nextActive = !category.active;
      return { ...category, active: nextActive };
    }));
    showFeedback(nextActive ? budgetsContent.feedback.categoryActivated : budgetsContent.feedback.categoryDeactivated);
  }

  function copyPreviousMonth() {
    const previousMonth = shiftMonth(monthKey, -1);
    const previousBudgets = budgets.filter((budget) => budget.month === previousMonth);
    if (!previousBudgets.length) {
      showFeedback(budgetsContent.feedback.nothingToCopy);
      return;
    }
    const existing = new Set(budgets.filter((budget) => budget.month === monthKey).map((budget) => budget.categoryId));
    const copies = previousBudgets
      .filter((budget) => !existing.has(budget.categoryId))
      .map((budget) => ({ ...budget, id: `budget-${budget.categoryId}-${monthKey}-${Date.now()}-${budget.categoryId}`, month: monthKey }));
    if (!copies.length) {
      showFeedback(budgetsContent.feedback.nothingToCopy);
      return;
    }
    setBudgets((current) => [...current, ...copies]);
    showFeedback(budgetsContent.feedback.copied);
  }

  return (
    <div className="financial-management-page budgets-page">
      <BudgetsHeading view={view} onNewBudget={openNewBudget} onNewCategory={() => setCategoryDialogOpen(true)} />
      <BudgetsSummary {...summary} />
      <BudgetsToolbar
        monthKey={monthKey}
        view={view}
        search={search}
        status={status}
        onPreviousMonth={() => setMonthKey((current) => shiftMonth(current, -1))}
        onNextMonth={() => setMonthKey((current) => shiftMonth(current, 1))}
        onCurrentMonth={() => setMonthKey(referenceMonth)}
        onViewChange={setView}
        onSearchChange={setSearch}
        onStatusChange={setStatus}
        onClear={() => { setSearch(""); setStatus("all"); }}
        onCopyPrevious={copyPreviousMonth}
      />

      {view === "budgets" ? (
        <div className="budgets-workspace-grid">
          <BudgetCategoryList rows={filteredRows} onEdit={(row) => { setEditingBudget(row); setBudgetDialogOpen(true); }} />
          <BudgetInsightPanel rows={rows} monthElapsed={monthElapsed} budgetUsed={summary.usage} projected={projected} />
        </div>
      ) : (
        <CategoriesManager categories={categories} onNew={() => setCategoryDialogOpen(true)} onToggle={toggleCategory} />
      )}

      {budgetDialogOpen ? (
        <BudgetDialog
          categories={categories}
          existingCategoryIds={rows.map((row) => row.categoryId)}
          editing={editingBudget}
          onClose={() => { setBudgetDialogOpen(false); setEditingBudget(null); }}
          onSubmit={submitBudget}
        />
      ) : null}

      {categoryDialogOpen ? (
        <CategoryDialog
          existingNames={categories.map((category) => category.name)}
          onClose={() => setCategoryDialogOpen(false)}
          onSubmit={submitCategory}
        />
      ) : null}

      {feedback ? <div className="transaction-feedback"><CheckIcon /> {feedback}</div> : null}
    </div>
  );
}
