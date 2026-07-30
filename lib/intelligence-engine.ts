import type { BillingCycle } from "@/types/assinaturas";
import type { PayableRecurrence } from "@/types/contas-a-pagar";
import type {
  ActualVsExpected,
  AnomalySensitivity,
  FinancialIntelligenceInput,
  FinancialIntelligenceProjection,
  GoalForecast,
  IntelligenceDailyPoint,
  IntelligenceMonthlyPoint,
  IntelligenceProjectionEvent,
  IntelligenceRisk,
  IntelligenceRiskSeverity,
  IntelligenceScenario,
  ProjectionHorizonDays,
  SpendingAnomaly,
} from "@/types/financial-intelligence";
import type { ReceivableRecurrence } from "@/types/recebimentos";

const MONTH_NAMES = [
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
const SHORT_MONTH_NAMES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

const SCENARIO_FACTORS: Record<IntelligenceScenario, { income: number; fixed: number; variable: number }> = {
  conservative: { income: 0.9, fixed: 1.03, variable: 1.12 },
  expected: { income: 1, fixed: 1, variable: 1 },
  optimistic: { income: 1.08, fixed: 0.99, variable: 0.94 },
};

function dateFromKey(value: string): Date {
  return new Date(`${value}T12:00:00.000Z`);
}

function dateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function monthKey(value: string): string {
  return value.slice(0, 7);
}

function monthLabel(value: string): { label: string; shortLabel: string } {
  const [year, month] = value.split("-").map(Number);
  return {
    label: `${MONTH_NAMES[month - 1]} de ${year}`,
    shortLabel: SHORT_MONTH_NAMES[month - 1],
  };
}

export function addDays(value: string, amount: number): string {
  const date = dateFromKey(value);
  date.setUTCDate(date.getUTCDate() + amount);
  return dateKey(date);
}

export function addMonths(value: string, amount: number): string {
  const date = dateFromKey(value);
  const originalDay = date.getUTCDate();
  date.setUTCDate(1);
  date.setUTCMonth(date.getUTCMonth() + amount);
  const maximumDay = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0, 12)).getUTCDate();
  date.setUTCDate(Math.min(originalDay, maximumDay));
  return dateKey(date);
}

function addYears(value: string, amount: number): string {
  return addMonths(value, amount * 12);
}

function daysBetween(start: string, end: string): number {
  return Math.round((dateFromKey(end).getTime() - dateFromKey(start).getTime()) / 86_400_000);
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(value, minimum), maximum);
}

function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function finiteNumber(value: number, fallback = 0): number {
  return Number.isFinite(value) ? value : fallback;
}

function normalizeProjectionInput(input: FinancialIntelligenceInput): FinancialIntelligenceInput {
  const allowedHorizons: ProjectionHorizonDays[] = [30, 60, 90, 365];
  const horizonDays = allowedHorizons.includes(input.horizonDays) ? input.horizonDays : 90;
  const scenario: IntelligenceScenario = Object.prototype.hasOwnProperty.call(SCENARIO_FACTORS, input.scenario)
    ? input.scenario
    : "expected";
  const assumptions = input.assumptions;
  return {
    ...input,
    horizonDays,
    scenario,
    negativeBalanceThreshold: clamp(finiteNumber(input.negativeBalanceThreshold), -1_000_000_000, 1_000_000_000),
    assumptions: {
      ...assumptions,
      incomeAdjustmentPercent: clamp(finiteNumber(assumptions.incomeAdjustmentPercent), -90, 500),
      fixedExpenseAdjustmentPercent: clamp(finiteNumber(assumptions.fixedExpenseAdjustmentPercent), -90, 500),
      variableExpenseAdjustmentPercent: clamp(finiteNumber(assumptions.variableExpenseAdjustmentPercent), -90, 500),
      oneTimeIncome: clamp(finiteNumber(assumptions.oneTimeIncome), 0, 1_000_000_000),
      oneTimeExpense: clamp(finiteNumber(assumptions.oneTimeExpense), 0, 1_000_000_000),
      newMonthlyCommitment: clamp(finiteNumber(assumptions.newMonthlyCommitment), 0, 1_000_000_000),
      newCommitmentMonths: clamp(Math.trunc(finiteNumber(assumptions.newCommitmentMonths, 12)), 1, 120),
    },
  };
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle];
}

function average(values: number[]): number {
  return values.length > 0 ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

function normalizeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR")
    .trim();
}

function stableSerialize(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableSerialize).join(",")}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, entryValue]) => `${JSON.stringify(key)}:${stableSerialize(entryValue)}`);
  return `{${entries.join(",")}}`;
}

export function createSourceChecksum(value: unknown): string {
  const input = stableSerialize(value);
  let left = 0x811c9dc5;
  let right = 0x9e3779b9;
  for (let index = 0; index < input.length; index += 1) {
    const code = input.charCodeAt(index);
    left = Math.imul(left ^ code, 0x01000193) >>> 0;
    right = Math.imul(right ^ (code + index), 0x85ebca6b) >>> 0;
  }
  return `local64:${left.toString(16).padStart(8, "0")}${right.toString(16).padStart(8, "0")}`;
}

function recurrenceNext(value: string, recurrence: PayableRecurrence | ReceivableRecurrence): string | null {
  if (recurrence === "weekly") return addDays(value, 7);
  if (recurrence === "monthly") return addMonths(value, 1);
  if (recurrence === "yearly") return addYears(value, 1);
  return null;
}

function subscriptionNext(value: string, cycle: BillingCycle): string {
  if (cycle === "weekly") return addDays(value, 7);
  if (cycle === "quarterly") return addMonths(value, 3);
  if (cycle === "semiannual") return addMonths(value, 6);
  if (cycle === "annual") return addYears(value, 1);
  return addMonths(value, 1);
}

function inProjectionRange(date: string, referenceDate: string, endDate: string): boolean {
  return date > referenceDate && date <= endDate;
}

function pushRecurringOccurrences({
  firstDate,
  recurrence,
  referenceDate,
  endDate,
  maximum = 60,
  push,
}: {
  firstDate: string;
  recurrence: PayableRecurrence | ReceivableRecurrence;
  referenceDate: string;
  endDate: string;
  maximum?: number;
  push: (date: string, occurrence: number) => void;
}) {
  let date = firstDate;
  let occurrence = 0;
  let generated = 0;

  if (date <= referenceDate) {
    push(addDays(referenceDate, 1), occurrence);
    generated += 1;
    if (recurrence === "none") return;
    let advances = 0;
    while (date <= referenceDate && advances < 240) {
      const next = recurrenceNext(date, recurrence);
      if (!next) return;
      date = next;
      occurrence += 1;
      advances += 1;
    }
  }

  while (date <= endDate && generated < maximum) {
    if (date > referenceDate) {
      push(date, occurrence);
      generated += 1;
    }
    const next = recurrenceNext(date, recurrence);
    if (!next) break;
    date = next;
    occurrence += 1;
  }
}

function historicalMonths(referenceDate: string, count: number): string[] {
  const firstOfMonth = `${referenceDate.slice(0, 7)}-01`;
  return Array.from({ length: count }, (_, index) => monthKey(addMonths(firstOfMonth, index - count)));
}

function buildHistoricalBaselines(input: FinancialIntelligenceInput) {
  const months = historicalMonths(input.referenceDate, 6);
  const fixedCategories = new Set(
    [
      ...input.payables.map((item) => item.category),
      ...input.subscriptions.map(() => "Assinatura"),
      ...input.debts.map(() => "Dívidas"),
    ].map(normalizeText),
  );
  const completed = input.transactions.filter((item) => item.status === "completed" && item.date < input.referenceDate);
  const incomeByMonth = months.map((month) => completed
    .filter((item) => item.type === "income" && item.date.startsWith(month))
    .reduce((sum, item) => sum + item.amount, 0));
  const variableExpensesByMonth = months.map((month) => completed
    .filter((item) => (
      item.type === "expense"
      && item.date.startsWith(month)
      && !fixedCategories.has(normalizeText(item.category))
    ))
    .reduce((sum, item) => sum + item.amount, 0));
  const monthsWithIncome = incomeByMonth.filter((value) => value > 0);
  const monthsWithExpenses = variableExpensesByMonth.filter((value) => value > 0);
  return {
    months,
    completed,
    monthlyIncome: median(monthsWithIncome.length > 0 ? monthsWithIncome : incomeByMonth),
    monthlyVariableExpenses: median(monthsWithExpenses.length > 0 ? monthsWithExpenses : variableExpensesByMonth),
    observedMonths: Math.max(monthsWithIncome.length, monthsWithExpenses.length),
  };
}

function createEvent(
  partial: Omit<IntelligenceProjectionEvent, "id"> & { idSeed: string },
): IntelligenceProjectionEvent {
  return {
    id: `${partial.kind}:${partial.date}:${partial.idSeed}`,
    date: partial.date,
    kind: partial.kind,
    label: partial.label,
    amount: roundMoney(Math.max(partial.amount, 0)),
    direction: partial.direction,
    sourceId: partial.sourceId,
    confidence: clamp(partial.confidence, 0, 1),
    explanation: partial.explanation,
  };
}

function buildProjectionEvents(input: FinancialIntelligenceInput) {
  const endDate = addDays(input.referenceDate, input.horizonDays);
  const scenario = SCENARIO_FACTORS[input.scenario];
  const incomeFactor = scenario.income * (1 + input.assumptions.incomeAdjustmentPercent / 100);
  const fixedFactor = scenario.fixed * (1 + input.assumptions.fixedExpenseAdjustmentPercent / 100);
  const variableFactor = scenario.variable * (1 + input.assumptions.variableExpenseAdjustmentPercent / 100);
  const history = buildHistoricalBaselines(input);
  const events: IntelligenceProjectionEvent[] = [];

  const baselineConfidence = clamp(0.38 + history.observedMonths * 0.09, 0.38, 0.92);
  let baselineDate = addMonths(`${input.referenceDate.slice(0, 7)}-05`, 1);
  while (baselineDate <= endDate) {
    if (history.monthlyIncome > 0) {
      events.push(createEvent({
        idSeed: monthKey(baselineDate),
        date: baselineDate,
        kind: "historical-income",
        label: "Receita histórica esperada",
        amount: history.monthlyIncome * incomeFactor,
        direction: "income",
        sourceId: null,
        confidence: baselineConfidence,
        explanation: `Mediana de ${history.observedMonths || 1} mês(es) observados, ajustada pelo cenário ${input.scenario}.`,
      }));
    }
    if (history.monthlyVariableExpenses > 0) {
      events.push(createEvent({
        idSeed: monthKey(baselineDate),
        date: addDays(baselineDate, 10),
        kind: "historical-variable-expense",
        label: "Gastos variáveis esperados",
        amount: history.monthlyVariableExpenses * variableFactor,
        direction: "expense",
        sourceId: null,
        confidence: clamp(baselineConfidence - 0.08, 0.3, 0.85),
        explanation: "Mediana dos gastos variáveis dos últimos meses, sem compromissos fixos já identificados.",
      }));
    }
    baselineDate = addMonths(baselineDate, 1);
  }

  for (const transaction of input.transactions) {
    if (transaction.status === "completed" || !inProjectionRange(transaction.date, input.referenceDate, endDate)) continue;
    if (transaction.type === "transfer") continue;
    events.push(createEvent({
      idSeed: transaction.id,
      date: transaction.date,
      kind: "transaction",
      label: transaction.description,
      amount: transaction.amount * (transaction.type === "income" ? incomeFactor : fixedFactor),
      direction: transaction.type,
      sourceId: transaction.id,
      confidence: 0.98,
      explanation: "Lançamento futuro já cadastrado.",
    }));
  }

  for (const payable of input.payables) {
    if (payable.status === "paid") continue;
    const remaining = Math.max(payable.amount - payable.paidAmount, 0);
    if (remaining <= 0) continue;
    pushRecurringOccurrences({
      firstDate: payable.dueDate,
      recurrence: payable.recurrence,
      referenceDate: input.referenceDate,
      endDate,
      push: (date, occurrence) => events.push(createEvent({
        idSeed: `${payable.id}:${occurrence}`,
        date,
        kind: "payable",
        label: payable.description,
        amount: remaining * fixedFactor,
        direction: "expense",
        sourceId: payable.id,
        confidence: payable.valueType === "fixed" ? 0.98 : 0.82,
        explanation: occurrence === 0
          ? "Conta a pagar cadastrada, considerando o valor restante."
          : "Ocorrência futura estimada a partir da recorrência cadastrada.",
      })),
    });
  }

  for (const receivable of input.receivables) {
    if (receivable.status === "received") continue;
    const remaining = Math.max(receivable.amount - receivable.receivedAmount, 0);
    if (remaining <= 0) continue;
    pushRecurringOccurrences({
      firstDate: receivable.expectedDate,
      recurrence: receivable.recurrence,
      referenceDate: input.referenceDate,
      endDate,
      push: (date, occurrence) => events.push(createEvent({
        idSeed: `${receivable.id}:${occurrence}`,
        date,
        kind: "receivable",
        label: receivable.description,
        amount: remaining * incomeFactor,
        direction: "income",
        sourceId: receivable.id,
        confidence: occurrence === 0 ? 0.94 : 0.78,
        explanation: occurrence === 0
          ? "Recebimento previsto já cadastrado."
          : "Ocorrência futura estimada a partir da recorrência cadastrada.",
      })),
    });
  }

  for (const subscription of input.subscriptions) {
    if (subscription.status === "paused" || subscription.status === "cancelled") continue;
    let date = subscription.nextChargeDate;
    let occurrence = 0;
    while (date <= endDate && occurrence < 60) {
      if (date > input.referenceDate) {
        events.push(createEvent({
          idSeed: `${subscription.id}:${occurrence}`,
          date,
          kind: "subscription",
          label: subscription.name,
          amount: subscription.amount * fixedFactor,
          direction: "expense",
          sourceId: subscription.id,
          confidence: 0.98,
          explanation: "Cobrança calculada pelo ciclo da assinatura ativa.",
        }));
      }
      date = subscriptionNext(date, subscription.billingCycle);
      occurrence += 1;
    }
  }

  for (const debt of input.debts) {
    if (debt.status === "paid" || debt.currentBalance <= 0) continue;
    const remainingInstallments = Math.max(debt.totalInstallments - debt.paidInstallments, 1);
    let projectedOutstanding = debt.currentBalance;
    let scheduledDate = debt.nextDueDate;
    if (scheduledDate <= input.referenceDate) scheduledDate = addDays(input.referenceDate, 1);
    for (let index = 0; index < remainingInstallments && projectedOutstanding > 0; index += 1) {
      const date = addMonths(scheduledDate, index);
      if (date > endDate) break;
      const installment = Math.min(debt.installmentAmount, projectedOutstanding);
      events.push(createEvent({
        idSeed: `${debt.id}:${index}`,
        date,
        kind: "debt",
        label: debt.name,
        amount: installment * fixedFactor,
        direction: "expense",
        sourceId: debt.id,
        confidence: 0.97,
        explanation: index === 0 && debt.nextDueDate <= input.referenceDate
          ? "Parcela vencida posicionada no primeiro dia da projeção, limitada ao saldo atual da dívida."
          : "Parcela futura calculada pelo saldo e cronograma da dívida.",
      }));
      projectedOutstanding = Math.max(projectedOutstanding - installment, 0);
    }
  }

  for (const plan of input.installmentPlans) {
    const remainingInstallments = Math.max(plan.totalInstallments - plan.paidInstallments, 0);
    for (let index = 0; index < remainingInstallments; index += 1) {
      const date = addMonths(plan.nextChargeDate, index);
      if (date > endDate) break;
      if (date <= input.referenceDate) continue;
      events.push(createEvent({
        idSeed: `${plan.id}:${index}`,
        date,
        kind: "installment",
        label: plan.description,
        amount: plan.installmentAmount * fixedFactor,
        direction: "expense",
        sourceId: plan.id,
        confidence: 0.98,
        explanation: "Parcela de compra já contratada.",
      }));
    }
  }

  if (input.includeGoalContributions) {
    for (const goal of input.goals) {
      if (goal.status !== "active" || goal.monthlyContribution <= 0) continue;
      let date = addMonths(`${input.referenceDate.slice(0, 7)}-10`, 1);
      while (date <= endDate) {
        events.push(createEvent({
          idSeed: `${goal.id}:${monthKey(date)}`,
          date,
          kind: "goal",
          label: `Aporte · ${goal.name}`,
          amount: goal.monthlyContribution * fixedFactor,
          direction: "expense",
          sourceId: goal.id,
          confidence: 0.9,
          explanation: "Aporte mensal planejado para uma meta ativa.",
        }));
        date = addMonths(date, 1);
      }
    }
  }

  const assumptions = input.assumptions;
  if (assumptions.oneTimeIncome > 0 && assumptions.oneTimeIncomeDate && inProjectionRange(assumptions.oneTimeIncomeDate, input.referenceDate, endDate)) {
    events.push(createEvent({
      idSeed: "one-time-income",
      date: assumptions.oneTimeIncomeDate,
      kind: "simulated-income",
      label: "Entrada simulada",
      amount: assumptions.oneTimeIncome,
      direction: "income",
      sourceId: null,
      confidence: 1,
      explanation: "Valor informado manualmente no simulador; não altera os dados reais.",
    }));
  }
  if (assumptions.oneTimeExpense > 0 && assumptions.oneTimeExpenseDate && inProjectionRange(assumptions.oneTimeExpenseDate, input.referenceDate, endDate)) {
    events.push(createEvent({
      idSeed: "one-time-expense",
      date: assumptions.oneTimeExpenseDate,
      kind: "simulated-expense",
      label: "Compra ou saída simulada",
      amount: assumptions.oneTimeExpense,
      direction: "expense",
      sourceId: null,
      confidence: 1,
      explanation: "Valor informado manualmente no simulador; não altera os dados reais.",
    }));
  }
  if (assumptions.newMonthlyCommitment > 0 && assumptions.newCommitmentStartDate) {
    const months = clamp(Math.trunc(assumptions.newCommitmentMonths), 1, 120);
    for (let index = 0; index < months; index += 1) {
      const date = addMonths(assumptions.newCommitmentStartDate, index);
      if (date > endDate) break;
      if (date <= input.referenceDate) continue;
      events.push(createEvent({
        idSeed: `monthly-commitment:${index}`,
        date,
        kind: "simulated-commitment",
        label: "Novo compromisso simulado",
        amount: assumptions.newMonthlyCommitment,
        direction: "expense",
        sourceId: null,
        confidence: 1,
        explanation: `Compromisso simulado por até ${months} mês(es); não altera os dados reais.`,
      }));
    }
  }

  return { events, history, fixedFactor };
}

function buildDailyPoints(input: FinancialIntelligenceInput, events: IntelligenceProjectionEvent[]): IntelligenceDailyPoint[] {
  const startingBalance = input.accounts
    .filter((account) => account.includeInTotal)
    .reduce((sum, account) => sum + account.balance, 0);
  const byDate = new Map<string, IntelligenceProjectionEvent[]>();
  for (const event of events) {
    const current = byDate.get(event.date) ?? [];
    current.push(event);
    byDate.set(event.date, current);
  }
  let balance = startingBalance;
  return Array.from({ length: input.horizonDays }, (_, index) => {
    const date = addDays(input.referenceDate, index + 1);
    const dateEvents = (byDate.get(date) ?? []).sort((left, right) => left.label.localeCompare(right.label, "pt-BR"));
    const expectedIncome = dateEvents
      .filter((event) => event.direction === "income")
      .reduce((sum, event) => sum + event.amount, 0);
    const expectedExpenses = dateEvents
      .filter((event) => event.direction === "expense")
      .reduce((sum, event) => sum + event.amount, 0);
    const netChange = expectedIncome - expectedExpenses;
    balance += netChange;
    const confidence = dateEvents.length > 0
      ? average(dateEvents.map((event) => event.confidence))
      : 0.72;
    return {
      date,
      expectedIncome: roundMoney(expectedIncome),
      expectedExpenses: roundMoney(expectedExpenses),
      netChange: roundMoney(netChange),
      projectedBalance: roundMoney(balance),
      confidence: roundMoney(confidence),
      events: dateEvents,
    };
  });
}

export function aggregateMonthlyProjection(daily: IntelligenceDailyPoint[]): IntelligenceMonthlyPoint[] {
  const months = new Map<string, IntelligenceDailyPoint[]>();
  for (const point of daily) {
    const key = monthKey(point.date);
    months.set(key, [...(months.get(key) ?? []), point]);
  }
  return Array.from(months.entries()).map(([month, points]) => {
    const labels = monthLabel(month);
    return {
      month,
      ...labels,
      expectedIncome: roundMoney(points.reduce((sum, point) => sum + point.expectedIncome, 0)),
      expectedExpenses: roundMoney(points.reduce((sum, point) => sum + point.expectedExpenses, 0)),
      netChange: roundMoney(points.reduce((sum, point) => sum + point.netChange, 0)),
      endingBalance: points.at(-1)?.projectedBalance ?? 0,
      lowestBalance: Math.min(...points.map((point) => point.projectedBalance)),
      confidence: roundMoney(average(points.map((point) => point.confidence))),
    };
  });
}

function severityForDeviation(deviationPercent: number): IntelligenceRiskSeverity {
  if (deviationPercent >= 100) return "critical";
  if (deviationPercent >= 45) return "attention";
  return "info";
}

export function detectSpendingAnomalies(
  input: FinancialIntelligenceInput,
): SpendingAnomaly[] {
  const thresholds: Record<AnomalySensitivity, number> = { low: 1.8, balanced: 1.45, high: 1.25 };
  const currentStart = addDays(input.referenceDate, -30);
  const priorStart = addDays(currentStart, -150);
  const expenses = input.transactions.filter((item) => item.status === "completed" && item.type === "expense");
  const categories = new Set(expenses.map((item) => item.category));
  const anomalies: SpendingAnomaly[] = [];

  for (const category of categories) {
    const currentAmount = expenses
      .filter((item) => item.category === category && item.date > currentStart && item.date <= input.referenceDate)
      .reduce((sum, item) => sum + item.amount, 0);
    const prior = expenses.filter((item) => item.category === category && item.date > priorStart && item.date <= currentStart);
    const priorMonthly = Array.from({ length: 5 }, (_, index) => {
      const end = addDays(currentStart, -(index * 30));
      const start = addDays(end, -30);
      return prior
        .filter((item) => item.date > start && item.date <= end)
        .reduce((sum, item) => sum + item.amount, 0);
    });
    const baselineAmount = median(priorMonthly.filter((value) => value > 0));
    if (baselineAmount <= 0 || currentAmount < baselineAmount * thresholds[input.anomalySensitivity]) continue;
    const deviationPercent = ((currentAmount - baselineAmount) / baselineAmount) * 100;
    anomalies.push({
      id: `category:${normalizeText(category)}`,
      category,
      currentAmount: roundMoney(currentAmount),
      baselineAmount: roundMoney(baselineAmount),
      deviationPercent: roundMoney(deviationPercent),
      severity: severityForDeviation(deviationPercent),
      explanation: `Nos últimos 30 dias, esta categoria ficou ${roundMoney(deviationPercent)}% acima da mediana dos cinco períodos anteriores.`,
    });
  }

  for (const subscription of input.subscriptions) {
    if (!subscription.previousAmount || subscription.previousAmount <= 0 || subscription.amount <= subscription.previousAmount) continue;
    const deviationPercent = ((subscription.amount - subscription.previousAmount) / subscription.previousAmount) * 100;
    if (deviationPercent < 10) continue;
    anomalies.push({
      id: `subscription:${subscription.id}`,
      category: subscription.name,
      currentAmount: subscription.amount,
      baselineAmount: subscription.previousAmount,
      deviationPercent: roundMoney(deviationPercent),
      severity: deviationPercent >= 25 ? "critical" : "attention",
      explanation: "O valor atual da assinatura está acima do valor anterior registrado.",
    });
  }

  return anomalies.sort((left, right) => right.deviationPercent - left.deviationPercent).slice(0, 8);
}

function buildGoalForecasts(input: FinancialIntelligenceInput): GoalForecast[] {
  return input.goals.map((goal) => {
    const remainingAmount = Math.max(goal.targetAmount - goal.currentAmount, 0);
    if (goal.status === "completed" || remainingAmount <= 0) {
      return {
        goalId: goal.id,
        name: goal.name,
        targetDate: goal.targetDate,
        projectedCompletionDate: input.referenceDate,
        remainingAmount: 0,
        requiredMonthlyContribution: 0,
        plannedMonthlyContribution: goal.monthlyContribution,
        status: "completed" as const,
        explanation: "A meta já atingiu o valor planejado.",
      };
    }
    const monthsUntilTarget = Math.max(Math.ceil(daysBetween(input.referenceDate, goal.targetDate) / 30.4375), 1);
    const requiredMonthlyContribution = remainingAmount / monthsUntilTarget;
    const planned = goal.monthlyContribution;
    const monthsToFinish = planned > 0 ? Math.ceil(remainingAmount / planned) : Number.POSITIVE_INFINITY;
    const projectedCompletionDate = Number.isFinite(monthsToFinish)
      ? addMonths(input.referenceDate, monthsToFinish)
      : null;
    const status: GoalForecast["status"] = planned <= 0
      ? "unreachable"
      : planned + 0.01 >= requiredMonthlyContribution
        ? "on-track"
        : "attention";
    return {
      goalId: goal.id,
      name: goal.name,
      targetDate: goal.targetDate,
      projectedCompletionDate,
      remainingAmount: roundMoney(remainingAmount),
      requiredMonthlyContribution: roundMoney(requiredMonthlyContribution),
      plannedMonthlyContribution: roundMoney(planned),
      status,
      explanation: status === "on-track"
        ? "O aporte planejado é suficiente para alcançar a meta até a data definida."
        : status === "unreachable"
          ? "Não há aporte mensal planejado para estimar a conclusão."
          : `O aporte atual está abaixo dos ${roundMoney(requiredMonthlyContribution)} necessários por mês.`,
    };
  }).sort((left, right) => {
    const order: Record<GoalForecast["status"], number> = { unreachable: 0, attention: 1, "on-track": 2, completed: 3 };
    return order[left.status] - order[right.status];
  });
}

function buildActualVsExpected(input: FinancialIntelligenceInput): ActualVsExpected {
  const currentMonth = monthKey(input.referenceDate);
  const priorMonths = historicalMonths(input.referenceDate, 6);
  const completed = input.transactions.filter((item) => item.status === "completed");
  const expectedIncome = median(priorMonths.map((month) => completed
    .filter((item) => item.type === "income" && item.date.startsWith(month))
    .reduce((sum, item) => sum + item.amount, 0)));
  const expectedExpenses = median(priorMonths.map((month) => completed
    .filter((item) => item.type === "expense" && item.date.startsWith(month))
    .reduce((sum, item) => sum + item.amount, 0)));
  const actualIncome = completed
    .filter((item) => item.type === "income" && item.date.startsWith(currentMonth))
    .reduce((sum, item) => sum + item.amount, 0);
  const actualExpenses = completed
    .filter((item) => item.type === "expense" && item.date.startsWith(currentMonth))
    .reduce((sum, item) => sum + item.amount, 0);
  return {
    month: currentMonth,
    expectedIncome: roundMoney(expectedIncome),
    actualIncome: roundMoney(actualIncome),
    incomeVariance: roundMoney(actualIncome - expectedIncome),
    expectedExpenses: roundMoney(expectedExpenses),
    actualExpenses: roundMoney(actualExpenses),
    expenseVariance: roundMoney(actualExpenses - expectedExpenses),
    expectedResult: roundMoney(expectedIncome - expectedExpenses),
    actualResult: roundMoney(actualIncome - actualExpenses),
  };
}

function buildRisks({
  input,
  daily,
  monthly,
  fixedEvents,
  historyMonthlyIncome,
  anomalies,
  reserveCoverageMonths,
}: {
  input: FinancialIntelligenceInput;
  daily: IntelligenceDailyPoint[];
  monthly: IntelligenceMonthlyPoint[];
  fixedEvents: IntelligenceProjectionEvent[];
  historyMonthlyIncome: number;
  anomalies: SpendingAnomaly[];
  reserveCoverageMonths: number;
}): IntelligenceRisk[] {
  const risks: IntelligenceRisk[] = [];
  const firstNegative = daily.find((point) => point.projectedBalance < input.negativeBalanceThreshold);
  if (firstNegative) {
    risks.push({
      id: "negative-balance",
      severity: "critical",
      title: "Risco de saldo negativo",
      message: `O saldo pode ficar abaixo do limite em ${firstNegative.date}.`,
      date: firstNegative.date,
      value: firstNegative.projectedBalance,
      recommendation: "Revise compromissos anteriores a essa data ou planeje uma entrada adicional.",
      explanation: "O cálculo soma entradas e saídas conhecidas, recorrências, histórico e hipóteses do cenário selecionado.",
    });
  }
  const negativeMonths = monthly.filter((point) => point.netChange < 0);
  if (negativeMonths.length > 0) {
    risks.push({
      id: "monthly-deficit",
      severity: negativeMonths.length >= 2 ? "critical" : "attention",
      title: "Mês com resultado projetado negativo",
      message: `${negativeMonths.length} período(s) mensal(is) apresentam saídas maiores que entradas.`,
      date: `${negativeMonths[0].month}-01`,
      value: Math.min(...negativeMonths.map((point) => point.netChange)),
      recommendation: "Compare os compromissos fixos com os gastos variáveis e teste um cenário de redução.",
      explanation: "O resultado mensal é a soma de todos os eventos projetados dentro do mês.",
    });
  }
  const fixedMonthly = fixedEvents.reduce((sum, event) => sum + event.amount, 0) / Math.max(input.horizonDays / 30.4375, 1);
  const fixedCommitmentRate = historyMonthlyIncome > 0 ? (fixedMonthly / historyMonthlyIncome) * 100 : 0;
  if (fixedCommitmentRate > 70) {
    risks.push({
      id: "fixed-commitments",
      severity: fixedCommitmentRate > 90 ? "critical" : "attention",
      title: "Renda muito comprometida",
      message: `${roundMoney(fixedCommitmentRate)}% da renda histórica está comprometida com despesas identificadas.`,
      date: null,
      value: fixedCommitmentRate,
      recommendation: "Priorize renegociação de dívidas, assinaturas e parcelas antes de assumir novos compromissos.",
      explanation: "A taxa compara compromissos mensais identificados com a mediana de renda dos meses observados.",
    });
  }
  if (reserveCoverageMonths < 1) {
    risks.push({
      id: "reserve-coverage",
      severity: reserveCoverageMonths <= 0.25 ? "critical" : "attention",
      title: "Reserva de emergência reduzida",
      message: `A reserva cobre aproximadamente ${roundMoney(reserveCoverageMonths)} mês(es) de compromissos essenciais.`,
      date: null,
      value: reserveCoverageMonths,
      recommendation: "Defina um aporte recorrente para ampliar gradualmente a cobertura.",
      explanation: "A cobertura divide o valor da meta de emergência pelos compromissos mensais identificados.",
    });
  }
  if (anomalies.some((item) => item.severity === "critical")) {
    risks.push({
      id: "spending-anomalies",
      severity: "attention",
      title: "Gastos atípicos detectados",
      message: "Uma ou mais categorias ficaram muito acima do padrão histórico recente.",
      date: null,
      value: anomalies.length,
      recommendation: "Revise os lançamentos destacados antes de considerar o padrão como recorrente.",
      explanation: "A análise usa a mediana dos períodos anteriores e não altera categorias nem lançamentos.",
    });
  }
  return risks.sort((left, right) => {
    const order: Record<IntelligenceRiskSeverity, number> = { critical: 0, attention: 1, info: 2 };
    return order[left.severity] - order[right.severity];
  });
}

export function buildFinancialIntelligenceProjection(
  input: FinancialIntelligenceInput,
): FinancialIntelligenceProjection {
  const normalizedInput = normalizeProjectionInput(input);
  const sourceChecksum = createSourceChecksum({
    ...normalizedInput,
    generatedAt: undefined,
  });
  const { events, history } = buildProjectionEvents(normalizedInput);
  const daily = buildDailyPoints(normalizedInput, events);
  const monthly = aggregateMonthlyProjection(daily);
  const startingBalance = normalizedInput.accounts
    .filter((account) => account.includeInTotal)
    .reduce((sum, account) => sum + account.balance, 0);
  const totalIncome = daily.reduce((sum, point) => sum + point.expectedIncome, 0);
  const totalExpenses = daily.reduce((sum, point) => sum + point.expectedExpenses, 0);
  const endingBalance = daily.at(-1)?.projectedBalance ?? startingBalance;
  const lowestBalance = daily.length > 0 ? Math.min(startingBalance, ...daily.map((point) => point.projectedBalance)) : startingBalance;
  const firstNegativeDate = daily.find((point) => point.projectedBalance < normalizedInput.negativeBalanceThreshold)?.date ?? null;
  const fixedKinds = new Set(["payable", "subscription", "debt", "installment", "goal", "simulated-commitment"]);
  const fixedEvents = events.filter((event) => fixedKinds.has(event.kind));
  const fixedMonthly = fixedEvents.reduce((sum, event) => sum + event.amount, 0) / Math.max(normalizedInput.horizonDays / 30.4375, 1);
  const fixedCommitmentRate = history.monthlyIncome > 0 ? (fixedMonthly / history.monthlyIncome) * 100 : 0;
  const emergencyReserve = normalizedInput.goals
    .filter((goal) => goal.category === "emergency")
    .reduce((sum, goal) => sum + goal.currentAmount, 0);
  const reserveCoverageMonths = fixedMonthly > 0 ? emergencyReserve / fixedMonthly : 0;
  const confidence = roundMoney(clamp(
    average(daily.map((point) => point.confidence)) * 0.75 + clamp(history.observedMonths / 6, 0, 1) * 0.25,
    0.2,
    0.98,
  ));
  const anomalies = detectSpendingAnomalies(normalizedInput);
  const goals = buildGoalForecasts(normalizedInput);
  const risks = buildRisks({
    input: normalizedInput,
    daily,
    monthly,
    fixedEvents,
    historyMonthlyIncome: history.monthlyIncome,
    anomalies,
    reserveCoverageMonths,
  });
  const actualVsExpected = buildActualVsExpected(normalizedInput);

  return {
    referenceDate: normalizedInput.referenceDate,
    horizonDays: normalizedInput.horizonDays,
    scenario: normalizedInput.scenario,
    sourceChecksum,
    generatedAt: new Date().toISOString(),
    daily,
    monthly,
    summary: {
      startingBalance: roundMoney(startingBalance),
      endingBalance: roundMoney(endingBalance),
      lowestBalance: roundMoney(lowestBalance),
      totalIncome: roundMoney(totalIncome),
      totalExpenses: roundMoney(totalExpenses),
      projectedResult: roundMoney(totalIncome - totalExpenses),
      firstNegativeDate,
      fixedCommitmentRate: roundMoney(fixedCommitmentRate),
      reserveCoverageMonths: roundMoney(reserveCoverageMonths),
      confidence,
    },
    risks,
    anomalies,
    goals,
    actualVsExpected,
    explanation: [
      `A projeção usa ${history.observedMonths} mês(es) com dados históricos e compromissos locais já cadastrados.`,
      "Valores do simulador são hipotéticos e nunca são gravados como lançamentos.",
      "O resultado é uma estimativa explicável, não uma garantia de saldo futuro.",
    ],
  };
}
