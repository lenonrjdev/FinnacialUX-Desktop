"use client";

import { useEffect, useMemo, useState } from "react";
import { ContributionDialog } from "@/components/metas/contribution-dialog";
import { ContributionsList } from "@/components/metas/contributions-list";
import { GoalDialog } from "@/components/metas/goal-dialog";
import { GoalsGrid } from "@/components/metas/goals-grid";
import { GoalsHeading } from "@/components/metas/goals-heading";
import { GoalsInsightPanel } from "@/components/metas/goals-insight-panel";
import { GoalsSummary } from "@/components/metas/goals-summary";
import { GoalsToolbar } from "@/components/metas/goals-toolbar";
import { CheckIcon } from "@/components/shared/icons";
import { useFinanceDataState } from "@/components/providers/finance-data-provider";
import { goalsContent } from "@/content/metas";
import { formatSearchDate, matchesSearch } from "@/lib/search";
import { initialAccounts } from "@/data/contas";
import {
  emergencyCoverageTarget,
  essentialMonthlyCost,
  goalsReferenceDate,
  initialGoalContributions,
  initialGoals,
} from "@/data/metas";
import type {
  ContributionFormInput,
  FinancialGoal,
  GoalComputedStatus,
  GoalFilter,
  GoalFormInput,
  GoalRow,
  GoalStatusFilter,
  GoalView,
  GoalContribution,
} from "@/types/metas";

function monthsBetween(referenceDate: string, targetDate: string): number {
  const reference = new Date(`${referenceDate}T12:00:00Z`);
  const target = new Date(`${targetDate}T12:00:00Z`);
  const total = (target.getUTCFullYear() - reference.getUTCFullYear()) * 12
    + target.getUTCMonth() - reference.getUTCMonth();
  return Math.max(target > reference ? total || 1 : 0, 0);
}

function computeGoal(goal: FinancialGoal): GoalRow {
  const remaining = Math.max(goal.targetAmount - goal.currentAmount, 0);
  const progress = goal.targetAmount > 0 ? (goal.currentAmount / goal.targetAmount) * 100 : 0;
  const monthsRemaining = monthsBetween(goalsReferenceDate, goal.targetDate);
  const requiredMonthly = monthsRemaining > 0 ? remaining / monthsRemaining : remaining;
  let computedStatus: GoalComputedStatus = "on-track";

  if (goal.status === "completed" || remaining === 0) computedStatus = "completed";
  else if (goal.status === "paused") computedStatus = "paused";
  else if (monthsRemaining === 0 || goal.monthlyContribution + 0.01 < requiredMonthly) computedStatus = "attention";

  return { ...goal, remaining, progress, monthsRemaining, requiredMonthly, computedStatus };
}

export default function MetasView() {
  const [storedAccounts] = useFinanceDataState("accounts", initialAccounts);
  const accounts = useMemo(() => storedAccounts.map((account) => ({ id: account.id, name: account.name })), [storedAccounts]);
  const accountNames = useMemo(() => Object.fromEntries(accounts.map((account) => [account.id, account.name])), [accounts]);
  const [goals, setGoals] = useFinanceDataState<FinancialGoal[]>("goals", initialGoals);
  const [contributions, setContributions] = useFinanceDataState<GoalContribution[]>("goal-contributions", initialGoalContributions);
  const [view, setView] = useState<GoalView>("goals");
  const [search, setSearch] = useState("");
  const [type, setType] = useState<GoalFilter>("all");
  const [status, setStatus] = useState<GoalStatusFilter>("all");
  const [selectedGoalId, setSelectedGoalId] = useState("");
  const [editingGoal, setEditingGoal] = useState<FinancialGoal | null>(null);
  const [goalDialogOpen, setGoalDialogOpen] = useState(false);
  const [contributionDialogOpen, setContributionDialogOpen] = useState(false);
  const [contributionGoalId, setContributionGoalId] = useState<string | undefined>();
  const [feedback, setFeedback] = useState("");

  useEffect(() => {
    if (!selectedGoalId && goals[0]) setSelectedGoalId(goals[0].id);
    if (selectedGoalId && !goals.some((goal) => goal.id === selectedGoalId)) {
      setSelectedGoalId(goals[0]?.id ?? "");
    }
  }, [goals, selectedGoalId]);

  const goalRows = useMemo(() => goals.map(computeGoal), [goals]);
  const filteredGoals = useMemo(() => goalRows.filter((goal) => {
    const matchesQuery = matchesSearch(search, [
      goal.name,
      goal.description,
      goal.targetAmount,
      goal.currentAmount,
      goal.monthlyContribution,
      goal.targetDate,
      formatSearchDate(goal.targetDate),
      goalsContent.categories[goal.category],
      goalsContent.priorities[goal.priority],
      goalsContent.statuses[goal.computedStatus],
      goal.kind === "reserve" ? goalsContent.list.reserve : goalsContent.list.goal,
      accountNames[goal.accountId],
    ]);
    const matchesType = type === "all" || goal.kind === type;
    const matchesStatus = status === "all" || goal.status === status;
    return matchesQuery && matchesType && matchesStatus;
  }), [accountNames, goalRows, search, status, type]);

  const filteredGoalIds = useMemo(() => new Set(filteredGoals.map((goal) => goal.id)), [filteredGoals]);
  const filteredContributions = useMemo(() => contributions
    .filter((movement) => filteredGoalIds.has(movement.goalId))
    .sort((a, b) => b.date.localeCompare(a.date)), [contributions, filteredGoalIds]);

  const summary = useMemo(() => {
    const target = goalRows.reduce((total, goal) => total + goal.targetAmount, 0);
    const saved = goalRows.reduce((total, goal) => total + goal.currentAmount, 0);
    return {
      target,
      saved,
      remaining: Math.max(target - saved, 0),
      monthly: goalRows.filter((goal) => goal.status === "active").reduce((total, goal) => total + goal.monthlyContribution, 0),
    };
  }, [goalRows]);

  const activeGoals = goalRows.filter((goal) => goal.status === "active");
  const emergencyGoal = goalRows.find((goal) => goal.category === "emergency" && goal.kind === "reserve");

  function showFeedback(message: string) {
    setFeedback(message);
    window.setTimeout(() => setFeedback(""), 2600);
  }

  function openNewGoal() {
    setEditingGoal(null);
    setGoalDialogOpen(true);
  }

  function openEditGoal(goal: GoalRow) {
    setEditingGoal(goals.find((item) => item.id === goal.id) ?? null);
    setGoalDialogOpen(true);
  }

  function openContribution(goalId?: string) {
    setContributionGoalId(goalId);
    setContributionDialogOpen(true);
  }

  function submitGoal(input: GoalFormInput) {
    if (editingGoal) {
      setGoals((current) => current.map((goal) => goal.id === editingGoal.id ? { ...goal, ...input } : goal));
      showFeedback(goalsContent.goalDialog.successEdit);
    } else {
      const nextGoal: FinancialGoal = {
        id: `goal-${Date.now()}`,
        ...input,
        status: input.currentAmount >= input.targetAmount ? "completed" : "active",
        createdAt: goalsReferenceDate,
      };
      setGoals((current) => [...current, nextGoal]);
      setSelectedGoalId(nextGoal.id);
      showFeedback(goalsContent.goalDialog.successCreate);
    }
    setGoalDialogOpen(false);
    setEditingGoal(null);
  }

  function submitContribution(input: ContributionFormInput) {
    const nextMovement: GoalContribution = {
      id: `goal-movement-${Date.now()}`,
      ...input,
    };
    setContributions((current) => [nextMovement, ...current]);
    setGoals((current) => current.map((goal) => {
      if (goal.id !== input.goalId) return goal;
      const nextAmount = input.type === "deposit"
        ? Math.min(goal.currentAmount + input.amount, goal.targetAmount)
        : Math.max(goal.currentAmount - input.amount, 0);
      return {
        ...goal,
        currentAmount: nextAmount,
        status: nextAmount >= goal.targetAmount ? "completed" : goal.status === "completed" ? "active" : goal.status,
      };
    }));
    setContributionDialogOpen(false);
    setSelectedGoalId(input.goalId);
    showFeedback(input.type === "deposit" ? goalsContent.contributionDialog.successDeposit : goalsContent.contributionDialog.successWithdrawal);
  }

  function togglePause(goal: GoalRow) {
    const nextStatus = goal.status === "paused" ? "active" : "paused";
    setGoals((current) => current.map((item) => item.id === goal.id ? { ...item, status: nextStatus } : item));
    showFeedback(nextStatus === "active" ? goalsContent.feedback.resumed : goalsContent.feedback.paused);
  }

  function completeGoal(goal: GoalRow) {
    setGoals((current) => current.map((item) => item.id === goal.id ? { ...item, currentAmount: item.targetAmount, status: "completed" } : item));
    showFeedback(goalsContent.feedback.completed);
  }

  return (
    <div className="financial-management-page goals-page">
      <GoalsHeading onNewGoal={openNewGoal} onNewContribution={() => openContribution(selectedGoalId)} />
      <GoalsSummary {...summary} />
      <GoalsToolbar
        view={view}
        search={search}
        type={type}
        status={status}
        onViewChange={setView}
        onSearchChange={setSearch}
        onTypeChange={setType}
        onStatusChange={setStatus}
        onClear={() => { setSearch(""); setType("all"); setStatus("all"); }}
      />

      {view === "goals" ? (
        <div className="goals-workspace-grid">
          <GoalsGrid
            goals={filteredGoals}
            accountNames={accountNames}
            selectedId={selectedGoalId}
            onSelect={(goal) => setSelectedGoalId(goal.id)}
            onAddValue={(goal) => openContribution(goal.id)}
            onEdit={openEditGoal}
            onTogglePause={togglePause}
            onComplete={completeGoal}
          />
          <GoalsInsightPanel
            emergencyGoal={emergencyGoal}
            essentialMonthlyCost={essentialMonthlyCost}
            coverageTarget={emergencyCoverageTarget}
            activeGoals={activeGoals}
          />
        </div>
      ) : (
        <ContributionsList contributions={filteredContributions} goals={goalRows} accountNames={accountNames} />
      )}

      {goalDialogOpen ? (
        <GoalDialog
          editing={editingGoal}
          accounts={accounts}
          onClose={() => { setGoalDialogOpen(false); setEditingGoal(null); }}
          onSubmit={submitGoal}
        />
      ) : null}

      {contributionDialogOpen ? (
        <ContributionDialog
          goals={goalRows}
          accounts={accounts}
          initialGoalId={contributionGoalId}
          referenceDate={goalsReferenceDate}
          onClose={() => setContributionDialogOpen(false)}
          onSubmit={submitContribution}
        />
      ) : null}

      {feedback ? <div className="transaction-feedback"><CheckIcon /> {feedback}</div> : null}
    </div>
  );
}
