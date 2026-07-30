import type {
  DebtPlanProjection,
  FinancialPlanDraft,
  FinancialPlanningInput,
  FinancialPlanSimulation,
  GoalPlanProjection,
  PlanDeviation,
  PlanningAllocationKey,
  PlanningAllocationRow,
  PlanningCategoryLimit,
  PlanningDecision,
  PlanningHealth,
  PlanningMonthlyPoint,
  PlanningRecommendation,
} from "@/types/financial-planning";
import type { FinancialDebt } from "@/types/dividas";
import type { FinancialGoal } from "@/types/metas";

const ALLOCATION_LABELS: Record<PlanningAllocationKey, string> = {
  essentials: "Essenciais",
  lifestyle: "Estilo de vida",
  debts: "Redução de dívidas",
  goals: "Metas",
  reserve: "Reserva",
  flexible: "Margem flexível",
};

function roundMoney(value: number): number {
  return Math.round((Number.isFinite(value) ? value : 0) * 100) / 100;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(Number.isFinite(value) ? value : minimum, minimum), maximum);
}

function normalizeText(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR").trim();
}

function monthDate(value: string): Date {
  return new Date(`${value}-01T12:00:00.000Z`);
}

export function addPlanningMonths(value: string, amount: number): string {
  const date = monthDate(value);
  date.setUTCMonth(date.getUTCMonth() + amount);
  return date.toISOString().slice(0, 7);
}

function monthLabel(value: string): string {
  return new Intl.DateTimeFormat("pt-BR", { month: "short", year: "numeric", timeZone: "UTC" })
    .format(monthDate(value))
    .replace(" de ", "/");
}

function percentageDeviation(actual: number, planned: number): number {
  if (planned === 0) return actual === 0 ? 0 : 100;
  return ((actual - planned) / Math.abs(planned)) * 100;
}

function healthFromDeviation(deviationPercent: number, inverse = false): PlanningHealth {
  const value = inverse ? -deviationPercent : deviationPercent;
  if (value > 20) return "critical";
  if (value > 8) return "attention";
  return "healthy";
}

function stableSerialize(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableSerialize).join(",")}]`;
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${stableSerialize(record[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

export function createPlanningChecksum(value: unknown): string {
  const serialized = stableSerialize(value);
  let hash = 2166136261;
  for (let index = 0; index < serialized.length; index += 1) {
    hash ^= serialized.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `plan-${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

export function normalizeFinancialPlanDraft(draft: FinancialPlanDraft): FinancialPlanDraft {
  const percentages = draft.allocationPercentages;
  return {
    name: draft.name.trim().slice(0, 80) || "Meu plano financeiro",
    period: draft.period === "annual" ? "annual" : "monthly",
    startMonth: /^\d{4}-\d{2}$/.test(draft.startMonth) ? draft.startMonth : new Date().toISOString().slice(0, 7),
    durationMonths: Math.round(clamp(draft.period === "annual" ? 12 : draft.durationMonths, 1, 36)),
    monthlyIncomeTarget: roundMoney(clamp(draft.monthlyIncomeTarget, 0, 1_000_000_000)),
    allocationPercentages: {
      essentials: roundMoney(clamp(percentages.essentials, 0, 100)),
      lifestyle: roundMoney(clamp(percentages.lifestyle, 0, 100)),
      debts: roundMoney(clamp(percentages.debts, 0, 100)),
      goals: roundMoney(clamp(percentages.goals, 0, 100)),
      reserve: roundMoney(clamp(percentages.reserve, 0, 100)),
    },
    debtStrategy: ["avalanche", "snowball", "priority"].includes(draft.debtStrategy) ? draft.debtStrategy : "avalanche",
    extraDebtPayment: roundMoney(clamp(draft.extraDebtPayment, 0, 1_000_000_000)),
    reserveTargetMonths: roundMoney(clamp(draft.reserveTargetMonths, 1, 24)),
    categoryLimitAdjustmentPercent: roundMoney(clamp(draft.categoryLimitAdjustmentPercent, -50, 100)),
    goalPriorityOrder: Array.from(new Set(draft.goalPriorityOrder.filter(Boolean))).slice(0, 100),
  };
}

function resolveMonthlyIncome(input: FinancialPlanningInput, draft: FinancialPlanDraft): number {
  if (draft.monthlyIncomeTarget > 0) return draft.monthlyIncomeTarget;
  const months = input.projection.monthly.slice(0, Math.max(1, Math.min(6, input.projection.monthly.length)));
  const projected = months.reduce((sum, item) => sum + item.expectedIncome, 0) / Math.max(months.length, 1);
  if (projected > 0) return roundMoney(projected);
  const completedIncome = input.transactions
    .filter((item) => item.status === "completed" && item.type === "income")
    .reduce((sum, item) => sum + item.amount, 0);
  const observedMonths = new Set(input.transactions.filter((item) => item.status === "completed").map((item) => item.date.slice(0, 7))).size;
  return roundMoney(completedIncome / Math.max(observedMonths, 1));
}

function allocationRows(monthlyIncome: number, draft: FinancialPlanDraft): PlanningAllocationRow[] {
  const percentages = draft.allocationPercentages;
  const explicit = percentages.essentials + percentages.lifestyle + percentages.debts + percentages.goals + percentages.reserve;
  const flexible = Math.max(100 - explicit, 0);
  const rows: Array<[PlanningAllocationKey, number, string]> = [
    ["essentials", percentages.essentials, "Despesas necessárias e compromissos fixos."],
    ["lifestyle", percentages.lifestyle, "Consumo discricionário e qualidade de vida."],
    ["debts", percentages.debts, "Pagamento mínimo e aceleração das dívidas."],
    ["goals", percentages.goals, "Aportes nas metas priorizadas."],
    ["reserve", percentages.reserve, "Construção e recomposição da reserva."],
    ["flexible", flexible, "Margem não comprometida para absorver variações."],
  ];
  return rows.map(([key, percentage, explanation]) => ({
    key,
    label: ALLOCATION_LABELS[key],
    percentage: roundMoney(percentage),
    monthlyAmount: roundMoney(monthlyIncome * percentage / 100),
    annualAmount: roundMoney(monthlyIncome * percentage / 100 * 12),
    health: key === "flexible" && percentage < 5 ? "attention" : explicit > 100 ? "critical" : "healthy",
    explanation,
  }));
}

function historicalCategoryBaselines(input: FinancialPlanningInput, startMonth: string): Map<string, number> {
  const monthKeys = Array.from({ length: 3 }, (_, index) => addPlanningMonths(startMonth, index - 3));
  const totals = new Map<string, number>();
  for (const category of input.categories.filter((item) => item.type === "expense" && item.active)) {
    const normalized = normalizeText(category.name);
    const total = input.transactions
      .filter((item) => item.status === "completed" && item.type === "expense" && normalizeText(item.category) === normalized && monthKeys.includes(item.date.slice(0, 7)))
      .reduce((sum, item) => sum + item.amount, 0);
    totals.set(category.id, roundMoney(total / monthKeys.length));
  }
  return totals;
}

function categoryLimits(input: FinancialPlanningInput, draft: FinancialPlanDraft): PlanningCategoryLimit[] {
  const baselines = historicalCategoryBaselines(input, draft.startMonth);
  const currentMonth = input.monthlyBudgets.filter((item) => item.month === draft.startMonth);
  return input.categories
    .filter((item) => item.type === "expense" && item.active)
    .map((category) => {
      const baselineAmount = baselines.get(category.id) ?? 0;
      const budget = currentMonth.find((item) => item.categoryId === category.id);
      const base = budget?.limit ?? baselineAmount;
      const plannedLimit = roundMoney(Math.max(base * (1 + draft.categoryLimitAdjustmentPercent / 100), 0));
      const actual = input.transactions
        .filter((item) => item.status === "completed" && item.type === "expense" && item.date.startsWith(draft.startMonth) && normalizeText(item.category) === normalizeText(category.name))
        .reduce((sum, item) => sum + item.amount, 0);
      const deviationAmount = roundMoney(actual - plannedLimit);
      const deviationPercent = roundMoney(percentageDeviation(actual, plannedLimit));
      return {
        categoryId: category.id,
        categoryName: category.name,
        baselineAmount,
        currentBudget: budget?.limit ?? null,
        plannedLimit,
        alertThreshold: budget?.alertThreshold ?? 80,
        deviationAmount,
        deviationPercent,
        health: healthFromDeviation(deviationPercent),
        explanation: budget
          ? "Limite calculado a partir do orçamento atual e do ajuste definido no plano."
          : "Limite calculado pela média real dos últimos três meses.",
      };
    })
    .filter((item) => item.baselineAmount > 0 || item.currentBudget !== null)
    .sort((a, b) => b.plannedLimit - a.plannedLimit);
}

function debtOrder(debts: FinancialDebt[], strategy: FinancialPlanDraft["debtStrategy"]): FinancialDebt[] {
  const active = debts.filter((item) => item.currentBalance > 0 && !["paid"].includes(item.status));
  return [...active].sort((a, b) => {
    if (strategy === "snowball") return a.currentBalance - b.currentBalance;
    if (strategy === "priority") {
      const score = { high: 0, medium: 1, low: 2 };
      return score[a.priority] - score[b.priority] || b.annualInterestRate - a.annualInterestRate;
    }
    return b.annualInterestRate - a.annualInterestRate || a.currentBalance - b.currentBalance;
  });
}

function simulateDebtPlan(debts: FinancialDebt[], draft: FinancialPlanDraft, allocatedMonthly: number): DebtPlanProjection[] {
  const ordered = debtOrder(debts, draft.debtStrategy);
  const states = ordered.map((debt) => ({
    debt,
    balance: Math.max(debt.currentBalance, 0),
    totalInterest: 0,
    payoffMonth: null as string | null,
    extraApplied: 0,
  }));
  const baseMinimum = states.reduce((sum, state) => sum + Math.min(state.debt.installmentAmount, state.balance), 0);
  const plannedEnvelope = Math.max(allocatedMonthly, baseMinimum + draft.extraDebtPayment);
  const maximumMonths = 360;

  for (let month = 0; month < maximumMonths && states.some((state) => state.balance > 0.005); month += 1) {
    let remainingEnvelope = plannedEnvelope;
    for (const state of states) {
      if (state.balance <= 0.005) continue;
      const interest = state.balance * Math.max(state.debt.annualInterestRate, 0) / 1200;
      state.balance += interest;
      state.totalInterest += interest;
      const minimum = Math.min(Math.max(state.debt.installmentAmount, 0), state.balance, remainingEnvelope);
      state.balance -= minimum;
      remainingEnvelope -= minimum;
      if (state.balance <= 0.005 && !state.payoffMonth) state.payoffMonth = addPlanningMonths(draft.startMonth, month);
    }
    const target = states.find((state) => state.balance > 0.005);
    if (target && remainingEnvelope > 0) {
      const extra = Math.min(remainingEnvelope, target.balance);
      target.balance -= extra;
      target.extraApplied += extra;
      if (target.balance <= 0.005 && !target.payoffMonth) target.payoffMonth = addPlanningMonths(draft.startMonth, month);
    }
  }

  return states.map((state, index) => {
    const minimum = Math.max(state.debt.installmentAmount, 0);
    const baselineMonths = minimum > 0 ? Math.ceil(state.debt.currentBalance / minimum) : null;
    const projectedMonths = state.payoffMonth ? Math.max(1, index === -1 ? 1 : monthDifference(draft.startMonth, state.payoffMonth) + 1) : null;
    const baselineInterest = state.debt.currentBalance * Math.max(state.debt.annualInterestRate, 0) / 100 * ((baselineMonths ?? 12) / 12) / 2;
    return {
      debtId: state.debt.id,
      name: state.debt.name,
      strategyPosition: index + 1,
      startingBalance: roundMoney(state.debt.currentBalance),
      minimumPayment: roundMoney(minimum),
      extraPaymentApplied: roundMoney(state.extraApplied / Math.max(projectedMonths ?? 1, 1)),
      projectedPayoffMonth: state.payoffMonth,
      projectedMonths,
      projectedInterest: roundMoney(state.totalInterest),
      interestSavedEstimate: roundMoney(Math.max(baselineInterest - state.totalInterest, 0)),
      health: state.payoffMonth ? "healthy" : minimum > 0 ? "attention" : "critical",
      explanation: state.payoffMonth
        ? `Prioridade ${index + 1} pela estratégia ${draft.debtStrategy}; quitação estimada em ${state.payoffMonth}.`
        : "O pagamento planejado não quitou a dívida dentro do limite de 30 anos da simulação.",
    };
  });
}

function monthDifference(start: string, end: string): number {
  const startDate = monthDate(start);
  const endDate = monthDate(end);
  return (endDate.getUTCFullYear() - startDate.getUTCFullYear()) * 12 + endDate.getUTCMonth() - startDate.getUTCMonth();
}

function goalOrder(goals: FinancialGoal[], draft: FinancialPlanDraft): FinancialGoal[] {
  const custom = new Map(draft.goalPriorityOrder.map((id, index) => [id, index]));
  const priority = { high: 0, medium: 1, low: 2 };
  return goals
    .filter((goal) => goal.status === "active" && goal.currentAmount < goal.targetAmount)
    .sort((a, b) => {
      const customA = custom.get(a.id);
      const customB = custom.get(b.id);
      if (customA !== undefined || customB !== undefined) return (customA ?? 999) - (customB ?? 999);
      return priority[a.priority] - priority[b.priority] || a.targetDate.localeCompare(b.targetDate);
    });
}

function simulateGoalPlan(goals: FinancialGoal[], draft: FinancialPlanDraft, monthlyEnvelope: number): GoalPlanProjection[] {
  const ordered = goalOrder(goals, draft);
  const weights = ordered.map((goal) => goal.priority === "high" ? 3 : goal.priority === "medium" ? 2 : 1);
  const totalWeight = weights.reduce((sum, value) => sum + value, 0) || 1;
  return ordered.map((goal, index) => {
    const remaining = Math.max(goal.targetAmount - goal.currentAmount, 0);
    const allocated = roundMoney(monthlyEnvelope * weights[index] / totalWeight);
    const months = allocated > 0 ? Math.ceil(remaining / allocated) : null;
    const completion = months !== null ? addPlanningMonths(draft.startMonth, Math.max(months - 1, 0)) : null;
    const targetMonth = goal.targetDate.slice(0, 7);
    const monthsUntilTarget = Math.max(monthDifference(draft.startMonth, targetMonth) + 1, 1);
    const required = roundMoney(remaining / monthsUntilTarget);
    const health: PlanningHealth = completion === null ? "critical" : completion <= targetMonth ? "healthy" : "attention";
    return {
      goalId: goal.id,
      name: goal.name,
      priority: goal.priority,
      allocatedMonthlyAmount: allocated,
      requiredMonthlyAmount: required,
      projectedCompletionMonth: completion,
      targetMonth,
      health,
      explanation: completion
        ? `Aporte distribuído pela prioridade ${goal.priority}; conclusão estimada em ${completion}.`
        : "O plano não reservou recursos suficientes para estimar a conclusão desta meta.",
    };
  });
}

function buildMonthlyPlan(input: FinancialPlanningInput, draft: FinancialPlanDraft, allocations: PlanningAllocationRow[]): PlanningMonthlyPoint[] {
  const allocation = Object.fromEntries(allocations.map((item) => [item.key, item.monthlyAmount])) as Record<PlanningAllocationKey, number>;
  const projectionByMonth = new Map(input.projection.monthly.map((item) => [item.month, item]));
  let fallbackBalance = input.projection.summary.startingBalance;
  return Array.from({ length: draft.durationMonths }, (_, index) => {
    const month = addPlanningMonths(draft.startMonth, index);
    const projection = projectionByMonth.get(month);
    const plannedIncome = roundMoney(projection?.expectedIncome || allocation.essentials + allocation.lifestyle + allocation.debts + allocation.goals + allocation.reserve + allocation.flexible);
    const totalAllocation = allocation.essentials + allocation.lifestyle + allocation.debts + allocation.goals + allocation.reserve;
    const plannedResult = roundMoney(plannedIncome - totalAllocation);
    const projectedEndingBalance = roundMoney(projection?.endingBalance ?? fallbackBalance + plannedResult);
    fallbackBalance = projectedEndingBalance;
    return {
      month,
      label: monthLabel(month),
      plannedIncome,
      essentialLimit: allocation.essentials,
      lifestyleLimit: allocation.lifestyle,
      debtPayment: allocation.debts,
      goalContribution: allocation.goals,
      reserveContribution: allocation.reserve,
      flexibleAmount: allocation.flexible,
      plannedResult,
      projectedEndingBalance,
      health: projectedEndingBalance < 0 ? "critical" : allocation.flexible < plannedIncome * 0.05 ? "attention" : "healthy",
    };
  });
}

function currentMonthDeviations(input: FinancialPlanningInput, draft: FinancialPlanDraft, allocations: PlanningAllocationRow[], limits: PlanningCategoryLimit[]): PlanDeviation[] {
  const incomePlan = allocations.reduce((sum, item) => sum + item.monthlyAmount, 0);
  const actualIncome = input.transactions
    .filter((item) => item.status === "completed" && item.type === "income" && item.date.startsWith(draft.startMonth))
    .reduce((sum, item) => sum + item.amount, 0);
  const plannedExpenses = allocations.filter((item) => item.key !== "flexible").reduce((sum, item) => sum + item.monthlyAmount, 0);
  const actualExpenses = input.transactions
    .filter((item) => item.status === "completed" && item.type === "expense" && item.date.startsWith(draft.startMonth))
    .reduce((sum, item) => sum + item.amount, 0);
  const rows: PlanDeviation[] = [
    {
      id: "income",
      scope: "income",
      label: "Receita do mês",
      plannedAmount: roundMoney(incomePlan),
      actualAmount: roundMoney(actualIncome),
      deviationAmount: roundMoney(actualIncome - incomePlan),
      deviationPercent: roundMoney(percentageDeviation(actualIncome, incomePlan)),
      health: healthFromDeviation(percentageDeviation(actualIncome, incomePlan), true),
      explanation: "Compara a receita realizada no mês com a receita usada pelo plano.",
    },
    {
      id: "expenses",
      scope: "expenses",
      label: "Despesas do mês",
      plannedAmount: roundMoney(plannedExpenses),
      actualAmount: roundMoney(actualExpenses),
      deviationAmount: roundMoney(actualExpenses - plannedExpenses),
      deviationPercent: roundMoney(percentageDeviation(actualExpenses, plannedExpenses)),
      health: healthFromDeviation(percentageDeviation(actualExpenses, plannedExpenses)),
      explanation: "Compara as despesas realizadas com os envelopes de gastos do plano.",
    },
  ];
  for (const limit of limits.filter((item) => item.deviationPercent > 8).slice(0, 8)) {
    rows.push({
      id: `category:${limit.categoryId}`,
      scope: "category",
      label: limit.categoryName,
      plannedAmount: limit.plannedLimit,
      actualAmount: roundMoney(limit.plannedLimit + limit.deviationAmount),
      deviationAmount: limit.deviationAmount,
      deviationPercent: limit.deviationPercent,
      health: limit.health,
      explanation: limit.explanation,
    });
  }
  return rows;
}

function recommendations(
  draft: FinancialPlanDraft,
  allocations: PlanningAllocationRow[],
  debts: DebtPlanProjection[],
  goals: GoalPlanProjection[],
  deviations: PlanDeviation[],
  reserveCoverage: number,
): PlanningRecommendation[] {
  const result: PlanningRecommendation[] = [];
  const explicit = Object.values(draft.allocationPercentages).reduce((sum, value) => sum + value, 0);
  if (explicit > 100) result.push({
    id: "overallocation",
    priority: "high",
    title: "Distribuição acima da renda",
    message: `As alocações somam ${roundMoney(explicit)}% da receita mensal.`,
    action: "Reduza um ou mais percentuais antes de ativar o plano.",
    impactAmount: null,
    explanation: "Um plano acima de 100% não preserva margem para imprevistos.",
  });
  const flexible = allocations.find((item) => item.key === "flexible")?.percentage ?? 0;
  if (flexible < 5) result.push({
    id: "low-flexible",
    priority: "medium",
    title: "Margem flexível pequena",
    message: `Somente ${roundMoney(flexible)}% da renda permanece sem destino fixo.`,
    action: "Considere manter ao menos 5% para variações do mês.",
    impactAmount: allocations.find((item) => item.key === "flexible")?.monthlyAmount ?? null,
    explanation: "A margem flexível reduz a necessidade de romper o plano diante de gastos não previstos.",
  });
  if (reserveCoverage < draft.reserveTargetMonths) result.push({
    id: "reserve-gap",
    priority: reserveCoverage < 1 ? "high" : "medium",
    title: "Reserva abaixo do objetivo",
    message: `A cobertura atual é de ${roundMoney(reserveCoverage)} mês(es), abaixo da meta de ${draft.reserveTargetMonths}.`,
    action: "Preserve o envelope de reserva até atingir a cobertura planejada.",
    impactAmount: allocations.find((item) => item.key === "reserve")?.monthlyAmount ?? null,
    explanation: "A cobertura usa o saldo das contas incluídas e o envelope mensal de gastos essenciais.",
  });
  const unpayable = debts.filter((item) => item.projectedPayoffMonth === null);
  if (unpayable.length > 0) result.push({
    id: "debt-envelope",
    priority: "high",
    title: "Envelope de dívidas insuficiente",
    message: `${unpayable.length} dívida(s) não foram quitadas dentro do horizonte máximo da simulação.`,
    action: "Aumente o percentual de dívidas ou o pagamento extra mensal.",
    impactAmount: draft.extraDebtPayment,
    explanation: "A simulação respeita juros mensais, parcelas mínimas e a ordem da estratégia escolhida.",
  });
  const lateGoals = goals.filter((item) => item.health !== "healthy");
  if (lateGoals.length > 0) result.push({
    id: "goal-priority",
    priority: "medium",
    title: "Metas competindo pelos mesmos recursos",
    message: `${lateGoals.length} meta(s) podem terminar depois da data desejada.`,
    action: "Reordene as metas ou aumente o envelope mensal destinado a elas.",
    impactAmount: null,
    explanation: "Os recursos são distribuídos por prioridade e depois comparados com o aporte necessário.",
  });
  const criticalDeviation = deviations.find((item) => item.health === "critical");
  if (criticalDeviation) result.push({
    id: "current-deviation",
    priority: "high",
    title: "Desvio relevante no mês atual",
    message: `${criticalDeviation.label} está ${Math.abs(roundMoney(criticalDeviation.deviationPercent))}% distante do plano.`,
    action: "Revise o limite antes da ativação ou registre o motivo na revisão mensal.",
    impactAmount: Math.abs(criticalDeviation.deviationAmount),
    explanation: criticalDeviation.explanation,
  });
  return result;
}

function generatedDecisions(draft: FinancialPlanDraft, debts: DebtPlanProjection[], goals: GoalPlanProjection[], monthlyReviewDay: number): FinancialPlanSimulation["decisions"] {
  const reviewDate = `${draft.startMonth}-${String(Math.round(clamp(monthlyReviewDay, 1, 28))).padStart(2, "0")}`;
  const decisions: FinancialPlanSimulation["decisions"] = [{
    id: `review:${draft.startMonth}`,
    title: "Revisar o plano do mês",
    kind: "review",
    decisionDate: reviewDate,
    amount: null,
    status: "pending",
    notes: "Comparar plano, projeção e realizado antes de aceitar ajustes.",
    generated: true,
  }];
  for (const debt of debts.filter((item) => item.projectedPayoffMonth).slice(0, 6)) {
    decisions.push({
      id: `debt:${debt.debtId}`,
      title: `Revisar quitação de ${debt.name}`,
      kind: "debt",
      decisionDate: `${debt.projectedPayoffMonth}-15`,
      amount: debt.startingBalance,
      status: "pending",
      notes: debt.explanation,
      generated: true,
    });
  }
  for (const goal of goals.filter((item) => item.projectedCompletionMonth).slice(0, 6)) {
    decisions.push({
      id: `goal:${goal.goalId}`,
      title: `Revisar conclusão de ${goal.name}`,
      kind: "goal",
      decisionDate: `${goal.projectedCompletionMonth}-15`,
      amount: goal.allocatedMonthlyAmount,
      status: "pending",
      notes: goal.explanation,
      generated: true,
    });
  }
  return decisions;
}

export function buildFinancialPlanSimulation(rawInput: FinancialPlanningInput): FinancialPlanSimulation {
  const draft = normalizeFinancialPlanDraft(rawInput.draft);
  const input = { ...rawInput, draft };
  const monthlyIncome = resolveMonthlyIncome(input, draft);
  const effectiveDraft = { ...draft, monthlyIncomeTarget: monthlyIncome };
  const allocations = allocationRows(monthlyIncome, effectiveDraft);
  const categoryRows = categoryLimits(input, effectiveDraft);
  const debtEnvelope = allocations.find((item) => item.key === "debts")?.monthlyAmount ?? 0;
  const goalEnvelope = allocations.find((item) => item.key === "goals")?.monthlyAmount ?? 0;
  const debtPlan = simulateDebtPlan(input.debts, effectiveDraft, debtEnvelope);
  const goalPlan = simulateGoalPlan(input.goals, effectiveDraft, goalEnvelope);
  const monthly = buildMonthlyPlan(input, effectiveDraft, allocations);
  const deviations = currentMonthDeviations(input, effectiveDraft, allocations, categoryRows);
  const essential = allocations.find((item) => item.key === "essentials")?.monthlyAmount ?? 0;
  const availableBalance = input.accounts.filter((item) => item.includeInTotal).reduce((sum, item) => sum + Math.max(item.balance, 0), 0);
  const reserveCoverage = essential > 0 ? availableBalance / essential : 0;
  const reserveMonthly = allocations.find((item) => item.key === "reserve")?.monthlyAmount ?? 0;
  const projectedCoverage = essential > 0 ? (availableBalance + reserveMonthly * effectiveDraft.durationMonths) / essential : reserveCoverage;
  const recommendationsList = recommendations(effectiveDraft, allocations, debtPlan, goalPlan, deviations, reserveCoverage);
  const totalPercent = Object.values(effectiveDraft.allocationPercentages).reduce((sum, value) => sum + value, 0);
  const warnings: string[] = [];
  if (totalPercent > 100) warnings.push("A soma das alocações ultrapassa 100% da renda.");
  if (monthlyIncome <= 0) warnings.push("Não foi possível determinar uma renda mensal positiva para o plano.");
  if (input.projection.sourceChecksum.length < 4) warnings.push("A projeção de origem não possui um checksum válido.");
  const debtFreeMonths = debtPlan.map((item) => item.projectedPayoffMonth).filter((value): value is string => Boolean(value)).sort();
  const sourceChecksum = createPlanningChecksum({
    draft: effectiveDraft,
    projection: input.projection.sourceChecksum,
    monthlyReviewDay: Math.round(clamp(input.monthlyReviewDay, 1, 28)),
    accounts: input.accounts.map((item) => [item.id, item.balance]),
    debts: input.debts.map((item) => [item.id, item.currentBalance, item.annualInterestRate, item.installmentAmount]),
    goals: input.goals.map((item) => [item.id, item.currentAmount, item.targetAmount, item.targetDate]),
    budgets: input.monthlyBudgets.map((item) => [item.id, item.month, item.limit]),
    transactions: input.transactions.map((item) => [item.id, item.date, item.amount, item.status]),
  });
  const allocated = allocations.filter((item) => item.key !== "flexible").reduce((sum, item) => sum + item.monthlyAmount, 0);
  const flexibleAmount = allocations.find((item) => item.key === "flexible")?.monthlyAmount ?? 0;
  const summaryHealth: PlanningHealth = warnings.length > 0 || monthly.some((item) => item.health === "critical")
    ? "critical"
    : recommendationsList.some((item) => item.priority === "high")
      ? "attention"
      : "healthy";
  const summary = {
    monthlyIncomeTarget: monthlyIncome,
    monthlyAllocated: roundMoney(allocated),
    monthlyFlexible: roundMoney(flexibleAmount),
    allocationRate: monthlyIncome > 0 ? roundMoney(allocated / monthlyIncome * 100) : 0,
    totalDebtBalance: roundMoney(input.debts.reduce((sum, item) => sum + Math.max(item.currentBalance, 0), 0)),
    projectedDebtFreeMonth: debtPlan.length > 0 && debtPlan.every((item) => item.projectedPayoffMonth) ? debtFreeMonths.length > 0 ? debtFreeMonths[debtFreeMonths.length - 1] : null : null,
    reserveCoverageMonths: roundMoney(reserveCoverage),
    projectedReserveCoverageMonths: roundMoney(projectedCoverage),
    activeGoals: goalPlan.length,
    onTrackGoals: goalPlan.filter((item) => item.health === "healthy").length,
    health: summaryHealth,
  };
  const decisions = generatedDecisions(effectiveDraft, debtPlan, goalPlan, input.monthlyReviewDay);
  return {
    generatedAt: new Date().toISOString(),
    sourceChecksum,
    projectionChecksum: input.projection.sourceChecksum,
    draft: effectiveDraft,
    summary,
    allocations,
    categoryLimits: categoryRows,
    debtPlan,
    goalPlan,
    monthly,
    deviations,
    recommendations: recommendationsList,
    decisions,
    warnings,
    canActivate: warnings.length === 0 && summaryHealth !== "critical",
    explanation: [
      "O plano usa a projeção local da Fase 11 como referência, sem enviar dados para serviços externos.",
      "Ativar um plano salva limites, prioridades e decisões; não cria lançamentos nem pagamentos automaticamente.",
      "Toda revisão permanece manual e registra checksum, desvios e ajustes aceitos.",
    ],
  };
}
