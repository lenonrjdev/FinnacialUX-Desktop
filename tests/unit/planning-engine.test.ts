import { describe, expect, it } from "vitest";
import { buildFinancialPlanSimulation, createPlanningChecksum, normalizeFinancialPlanDraft } from "@/lib/planning-engine";
import { defaultPlanningDraft } from "@/types/financial-planning";
import type { FinancialPlanningInput } from "@/types/financial-planning";

function input(overrides: Partial<FinancialPlanningInput> = {}): FinancialPlanningInput {
  return {
    referenceDate: "2026-07-30",
    projection: {
      referenceDate: "2026-07-30",
      horizonDays: 365,
      scenario: "expected",
      sourceChecksum: "projection-1234",
      generatedAt: "2026-07-30T10:00:00.000Z",
      daily: [],
      monthly: [
        { month: "2026-08", label: "Agosto de 2026", shortLabel: "Ago", expectedIncome: 10000, expectedExpenses: 7000, netChange: 3000, endingBalance: 8000, lowestBalance: 5000, confidence: 0.9 },
        { month: "2026-09", label: "Setembro de 2026", shortLabel: "Set", expectedIncome: 10000, expectedExpenses: 7000, netChange: 3000, endingBalance: 11000, lowestBalance: 8000, confidence: 0.9 },
      ],
      summary: { startingBalance: 5000, endingBalance: 11000, lowestBalance: 5000, totalIncome: 20000, totalExpenses: 14000, projectedResult: 6000, firstNegativeDate: null, fixedCommitmentRate: 40, reserveCoverageMonths: 1, confidence: 0.9 },
      risks: [], anomalies: [], goals: [],
      actualVsExpected: { month: "2026-07", expectedIncome: 10000, actualIncome: 10000, incomeVariance: 0, expectedExpenses: 7000, actualExpenses: 7000, expenseVariance: 0, expectedResult: 3000, actualResult: 3000 },
      explanation: [],
    },
    monthlyReviewDay: 25,
    draft: { ...defaultPlanningDraft, startMonth: "2026-08", monthlyIncomeTarget: 10000, allocationPercentages: { essentials: 45, lifestyle: 15, debts: 15, goals: 10, reserve: 10 } },
    accounts: [{ id: "account-1", name: "Conta", institution: "Banco", type: "checking", group: "bank", icon: "bank", balance: 5000, projectedBalance: 5000, includeInTotal: true, createdAt: "2026-01-01" }],
    transactions: [
      { id: "income-1", description: "Salário", category: "Renda", account: "Conta", paymentMethod: "Pix", date: "2026-08-05", amount: 10000, type: "income", status: "completed" },
      { id: "food-1", description: "Mercado", category: "Alimentação", account: "Conta", paymentMethod: "Débito", date: "2026-05-05", amount: 1000, type: "expense", status: "completed" },
      { id: "food-2", description: "Mercado", category: "Alimentação", account: "Conta", paymentMethod: "Débito", date: "2026-06-05", amount: 1200, type: "expense", status: "completed" },
      { id: "food-3", description: "Mercado", category: "Alimentação", account: "Conta", paymentMethod: "Débito", date: "2026-07-05", amount: 1100, type: "expense", status: "completed" },
    ],
    categories: [{ id: "food", name: "Alimentação", type: "expense", description: "", tone: "sage", active: true, isDefault: true }],
    monthlyBudgets: [{ id: "budget-food", categoryId: "food", month: "2026-08", limit: 1500, alertThreshold: 80 }],
    debts: [{ id: "debt-1", name: "Crédito", creditor: "Banco", type: "personal-loan", originalAmount: 10000, currentBalance: 6000, annualInterestRate: 24, totalInstallments: 24, paidInstallments: 6, installmentAmount: 500, nextDueDate: "2026-08-10", startDate: "2026-01-10", accountId: "account-1", status: "active", priority: "high", notes: "", createdAt: "2026-01-01" }],
    goals: [{ id: "goal-1", name: "Reserva", description: "", kind: "reserve", category: "emergency", tone: "sage", targetAmount: 12000, currentAmount: 3000, monthlyContribution: 500, targetDate: "2027-12-01", accountId: "account-1", priority: "high", status: "active", createdAt: "2026-01-01" }],
    ...overrides,
  } as FinancialPlanningInput;
}

describe("motor de planejamento financeiro", () => {
  it("distribui a renda e preserva margem flexível", () => {
    const simulation = buildFinancialPlanSimulation(input());
    expect(simulation.summary.monthlyIncomeTarget).toBe(10000);
    expect(simulation.summary.monthlyFlexible).toBe(500);
    expect(simulation.allocations.reduce((sum, row) => sum + row.percentage, 0)).toBe(100);
    expect(simulation.canActivate).toBe(true);
  });

  it("bloqueia ativação quando as alocações ultrapassam a renda", () => {
    const raw = input();
    raw.draft = { ...raw.draft, allocationPercentages: { essentials: 60, lifestyle: 30, debts: 20, goals: 10, reserve: 10 } };
    const simulation = buildFinancialPlanSimulation(raw);
    expect(simulation.canActivate).toBe(false);
    expect(simulation.warnings.join(" ")).toContain("100%");
  });

  it("prioriza a dívida de maior juros na estratégia avalanche", () => {
    const raw = input();
    raw.debts = [
      ...raw.debts,
      { ...raw.debts[0], id: "debt-2", name: "Financiamento", currentBalance: 3000, annualInterestRate: 8, priority: "medium" },
    ];
    const simulation = buildFinancialPlanSimulation(raw);
    expect(simulation.debtPlan[0].debtId).toBe("debt-1");
    expect(simulation.debtPlan[0].projectedPayoffMonth).not.toBeNull();
  });

  it("gera limites, revisão e calendário de decisões explicáveis", () => {
    const simulation = buildFinancialPlanSimulation(input());
    expect(simulation.categoryLimits[0].categoryName).toBe("Alimentação");
    expect(simulation.deviations.some((item) => item.scope === "income")).toBe(true);
    expect(simulation.decisions.some((item) => item.kind === "review")).toBe(true);
    expect(simulation.explanation.join(" ")).toContain("manual");
  });

  it("mantém checksum determinístico e normaliza valores extremos", () => {
    const first = buildFinancialPlanSimulation(input());
    const second = buildFinancialPlanSimulation(input());
    expect(first.sourceChecksum).toBe(second.sourceChecksum);
    expect(createPlanningChecksum({ a: 1, b: 2 })).toBe(createPlanningChecksum({ b: 2, a: 1 }));
    const normalized = normalizeFinancialPlanDraft({ ...defaultPlanningDraft, durationMonths: 999, reserveTargetMonths: Number.POSITIVE_INFINITY });
    expect(normalized.durationMonths).toBe(36);
    expect(normalized.reserveTargetMonths).toBe(1);
  });
});
