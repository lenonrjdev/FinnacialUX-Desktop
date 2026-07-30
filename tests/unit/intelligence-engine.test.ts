import { describe, expect, it } from "vitest";
import {
  addMonths,
  aggregateMonthlyProjection,
  buildFinancialIntelligenceProjection,
  createSourceChecksum,
  detectSpendingAnomalies,
} from "@/lib/intelligence-engine";
import type { FinancialIntelligenceInput } from "@/types/financial-intelligence";
import { defaultIntelligenceAssumptions } from "@/types/financial-intelligence";

function baseInput(): FinancialIntelligenceInput {
  return {
    referenceDate: "2026-07-30",
    horizonDays: 90,
    scenario: "expected",
    assumptions: { ...defaultIntelligenceAssumptions },
    anomalySensitivity: "balanced",
    negativeBalanceThreshold: 0,
    includeGoalContributions: true,
    accounts: [{
      id: "account-1",
      name: "Conta principal",
      institution: "Local",
      type: "checking",
      group: "bank",
      icon: "bank",
      balance: 4_000,
      projectedBalance: 4_000,
      includeInTotal: true,
      createdAt: "2026-01-01",
    }],
    transactions: [
      ...Array.from({ length: 6 }, (_, index) => ({
        id: `income-${index}`,
        description: "Salário",
        category: "Salário",
        account: "Conta principal",
        paymentMethod: "Transferência",
        date: `2026-0${index + 1}-05`,
        amount: 5_000,
        type: "income" as const,
        status: "completed" as const,
      })),
      ...Array.from({ length: 6 }, (_, index) => ({
        id: `expense-${index}`,
        description: "Mercado",
        category: "Alimentação",
        account: "Conta principal",
        paymentMethod: "Débito",
        date: `2026-0${index + 1}-15`,
        amount: 1_000,
        type: "expense" as const,
        status: "completed" as const,
      })),
    ],
    payables: [{
      id: "rent",
      description: "Aluguel",
      category: "Moradia",
      amount: 1_500,
      paidAmount: 0,
      dueDate: "2026-08-05",
      accountId: "account-1",
      status: "pending",
      recurrence: "monthly",
      valueType: "fixed",
      createdAt: "2026-01-01",
    }],
    receivables: [],
    subscriptions: [],
    debts: [],
    installmentPlans: [],
    goals: [],
  };
}

describe("intelligence engine", () => {
  it("mantém datas mensais válidas ao avançar do dia 31", () => {
    expect(addMonths("2025-01-31", 1)).toBe("2025-02-28");
    expect(addMonths("2024-01-31", 1)).toBe("2024-02-29");
  });

  it("gera checksum estável sem depender da ordem das chaves", () => {
    expect(createSourceChecksum({ b: 2, a: 1 })).toBe(createSourceChecksum({ a: 1, b: 2 }));
    expect(createSourceChecksum({ a: 1 })).not.toBe(createSourceChecksum({ a: 2 }));
  });

  it("projeta compromissos recorrentes e preserva o saldo consolidado", () => {
    const projection = buildFinancialIntelligenceProjection(baseInput());
    const rentEvents = projection.daily.flatMap((point) => point.events).filter((event) => event.sourceId === "rent");
    expect(rentEvents.length).toBeGreaterThanOrEqual(2);
    expect(projection.summary.startingBalance).toBe(4_000);
    expect(projection.daily).toHaveLength(90);
    expect(projection.monthly.length).toBeGreaterThanOrEqual(3);
  });

  it("sinaliza saldo negativo quando um compromisso simulado excede o caixa", () => {
    const input = baseInput();
    input.horizonDays = 30;
    input.assumptions = {
      ...defaultIntelligenceAssumptions,
      oneTimeExpense: 20_000,
      oneTimeExpenseDate: "2026-08-02",
    };
    const projection = buildFinancialIntelligenceProjection(input);
    expect(projection.summary.firstNegativeDate).toBe("2026-08-02");
    expect(projection.risks.some((risk) => risk.id === "negative-balance")).toBe(true);
  });

  it("detecta gasto por categoria muito acima da mediana histórica", () => {
    const input = baseInput();
    input.transactions.push({
      id: "recent-anomaly",
      description: "Compra extraordinária",
      category: "Alimentação",
      account: "Conta principal",
      paymentMethod: "Débito",
      date: "2026-07-25",
      amount: 4_000,
      type: "expense",
      status: "completed",
    });
    const anomalies = detectSpendingAnomalies(input);
    expect(anomalies.some((item) => item.category === "Alimentação")).toBe(true);
  });

  it("agrega pontos diários por mês sem perder o saldo final", () => {
    const projection = buildFinancialIntelligenceProjection(baseInput());
    const monthly = aggregateMonthlyProjection(projection.daily);
    expect(monthly.at(-1)?.endingBalance).toBe(projection.daily.at(-1)?.projectedBalance);
    expect(monthly.reduce((sum, row) => sum + row.netChange, 0)).toBeCloseTo(projection.summary.projectedResult, 2);
  });



  it("posiciona conta vencida no primeiro dia sem perder recorrências futuras", () => {
    const input = baseInput();
    input.horizonDays = 60;
    input.payables = [{
      ...input.payables[0],
      id: "overdue-rent",
      dueDate: "2026-07-10",
      recurrence: "monthly",
    }];
    const projection = buildFinancialIntelligenceProjection(input);
    const events = projection.daily
      .flatMap((point) => point.events)
      .filter((event) => event.sourceId === "overdue-rent");
    expect(events[0].date).toBe("2026-07-31");
    expect(events.some((event) => event.date === "2026-08-10")).toBe(true);
  });

  it("limita parcelas projetadas ao saldo atual da dívida", () => {
    const input = baseInput();
    input.debts = [{
      id: "debt-1",
      name: "Empréstimo",
      creditor: "Banco local",
      type: "personal-loan",
      originalAmount: 2_000,
      currentBalance: 1_000,
      annualInterestRate: 10,
      totalInstallments: 8,
      paidInstallments: 4,
      installmentAmount: 500,
      nextDueDate: "2026-08-02",
      startDate: "2026-01-02",
      accountId: "account-1",
      status: "active",
      priority: "high",
      notes: "",
      createdAt: "2026-01-01",
    }];
    const projection = buildFinancialIntelligenceProjection(input);
    const debtTotal = projection.daily
      .flatMap((point) => point.events)
      .filter((event) => event.sourceId === "debt-1")
      .reduce((total, event) => total + event.amount, 0);
    expect(debtTotal).toBe(1_000);
  });

  it("estima conclusão de meta conforme o aporte planejado", () => {
    const input = baseInput();
    input.goals = [{
      id: "goal-1",
      name: "Reserva",
      description: "Reserva local",
      kind: "reserve",
      category: "emergency",
      tone: "sage",
      targetAmount: 12_000,
      currentAmount: 6_000,
      monthlyContribution: 1_000,
      targetDate: "2027-02-28",
      accountId: "account-1",
      priority: "high",
      status: "active",
      createdAt: "2026-01-01",
    }];
    const projection = buildFinancialIntelligenceProjection(input);
    expect(projection.goals[0].projectedCompletionDate).toBe("2027-01-30");
    expect(projection.goals[0].status).toBe("on-track");
  });
});
