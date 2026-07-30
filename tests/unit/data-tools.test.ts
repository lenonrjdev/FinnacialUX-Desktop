import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  applyAutomationRules,
  buildAllExportTables,
  buildExportTable,
  buildFullBackup,
  buildImportRows,
  inferCsvMapping,
  normalizeDate,
  parseCsvFile,
  parseMoney,
  parseOfxFile,
  reviewImportRow,
  tableToCsv,
  tableToRecords,
  testAutomationRules,
  type FinancialExportData,
} from "@/lib/data-tools";
import type { AutomationRule, ImportTransactionRow } from "@/types/dados-e-automacoes";
import type { FinancialTransaction } from "@/types/lancamentos";

const fixture = (name: string) => readFileSync(path.join(process.cwd(), "tests", "fixtures", name), "utf8");

function importRow(overrides: Partial<ImportTransactionRow> = {}): ImportTransactionRow {
  return {
    id: "row-1",
    date: "2026-07-29",
    description: "Mercado Central",
    amount: 125.9,
    type: "expense",
    category: "Sem categoria",
    account: "Conta principal",
    selected: true,
    status: "ready",
    issues: [],
    original: {},
    ...overrides,
  };
}

const rules: AutomationRule[] = [
  {
    id: "rule-2",
    name: "Regra posterior",
    active: true,
    priority: 20,
    field: "description",
    operator: "contains",
    value: "mercado",
    actions: { category: "Compras" },
    createdAt: "2026-07-29T00:00:00.000Z",
  },
  {
    id: "rule-1",
    name: "Regra prioritária",
    active: true,
    priority: 10,
    field: "description",
    operator: "starts-with",
    value: "Mercado",
    actions: { category: "Alimentação", account: "Carteira", type: "expense" },
    createdAt: "2026-07-29T00:00:00.000Z",
  },
];

describe("importação CSV e OFX", () => {
  it("detecta separador, BOM, aspas e valores brasileiros", () => {
    const parsed = parseCsvFile(`\uFEFF${fixture("importacao.csv")}`, "extrato.csv");

    expect(parsed.sourceType).toBe("csv");
    expect(parsed.headers).toEqual(["Data", "Descrição", "Valor", "Tipo", "Categoria", "Conta"]);
    expect(parsed.records).toHaveLength(2);
    expect(parsed.records[0]).toMatchObject({
      Data: "29/07/2026",
      Descrição: "Mercado, bairro",
      Valor: "R$ 125,90",
    });
  });

  it("aceita CSV separado por vírgula e cabeçalho vazio", () => {
    const parsed = parseCsvFile('Data,,Valor\n2026-07-29,"Descrição, completa",10.50', "dados.csv");

    expect(parsed.headers).toEqual(["Data", "Coluna 2", "Valor"]);
    expect(parsed.records[0]["Coluna 2"]).toBe("Descrição, completa");
  });

  it("interpreta transações OFX com NAME ou MEMO", () => {
    const parsed = parseOfxFile(fixture("importacao.ofx"), "banco.ofx");

    expect(parsed.records).toHaveLength(2);
    expect(parsed.records[0]).toMatchObject({
      Data: "20260729",
      Descrição: "MERCADO CENTRAL",
      Valor: "-125.90",
      Tipo: "DEBIT",
      Identificador: "tx-001",
    });
    expect(parsed.records[1].Descrição).toBe("SALARIO");
  });
});

describe("normalização e revisão de importação", () => {
  it("infere colunas com acentos e nomes usados por bancos", () => {
    expect(inferCsvMapping(["Data de vencimento", "Histórico", "TRNAMT", "Natureza", "Categoria", "Banco", "FITID"]))
      .toEqual({
        "Data de vencimento": "date",
        Histórico: "description",
        TRNAMT: "amount",
        Natureza: "type",
        Categoria: "category",
        Banco: "account",
        FITID: "ignore",
      });
  });

  it.each([
    ["20260729", "2026-07-29"],
    ["29/07/2026", "2026-07-29"],
    ["9-7-2026", "2026-07-09"],
    ["2026-7-9T10:00:00", "2026-07-09"],
    ["sem data", ""],
  ])("normaliza a data %s", (input, expected) => {
    expect(normalizeDate(input)).toBe(expected);
  });

  it.each([
    ["R$ 1.234,56", 1234.56],
    ["-125,90", -125.9],
    ["5000.00", 5000],
    ["", 0],
    ["inválido", 0],
  ])("normaliza o valor %s", (input, expected) => {
    expect(parseMoney(input)).toBe(expected);
  });

  it("aplica somente a regra ativa de maior prioridade", () => {
    const result = applyAutomationRules(importRow(), rules);

    expect(result).toMatchObject({ category: "Alimentação", account: "Carteira", type: "expense" });
  });

  it("marca campos inválidos para revisão", () => {
    const reviewed = reviewImportRow(importRow({ date: "", description: "", amount: 0 }));

    expect(reviewed.status).toBe("review");
    expect(reviewed.selected).toBe(false);
    expect(reviewed.issues).toHaveLength(3);
  });

  it("marca duplicidade por data, descrição normalizada e valor absoluto", () => {
    const existing = [{
      date: "2026-07-29",
      description: "MERCADO CENTRAL",
      amount: 125.9,
    }] as FinancialTransaction[];

    const reviewed = reviewImportRow(importRow(), existing);
    expect(reviewed.status).toBe("duplicate");
    expect(reviewed.selected).toBe(false);
  });

  it("constrói linhas, aplica automação e mantém despesas com valor absoluto", () => {
    const records = parseCsvFile(fixture("importacao.csv"), "extrato.csv").records;
    const mapping = inferCsvMapping(Object.keys(records[0]));
    const rows = buildImportRows(records, mapping, rules);

    expect(rows[0]).toMatchObject({
      date: "2026-07-29",
      description: "Mercado, bairro",
      amount: 125.9,
      type: "expense",
      category: "Alimentação",
      account: "Carteira",
      status: "ready",
    });
    expect(rows[1]).toMatchObject({ amount: 5000, type: "income" });
  });

  it("simula regras sobre dados existentes e importados", () => {
    const result = testAutomationRules(rules, [importRow()], []);

    expect(result).toEqual([
      { ruleId: "rule-2", matches: 1, examples: ["Mercado Central"] },
      { ruleId: "rule-1", matches: 1, examples: ["Mercado Central"] },
    ]);
  });
});

function exportData(): FinancialExportData {
  return {
    transactions: [{ id: "tx-1", date: "2026-07-29", description: "Mercado", category: "Alimentação", account: "Conta", destinationAccount: null, paymentMethod: "pix", type: "expense", status: "completed", amount: 125.9, note: "mensal" }],
    accounts: [{ id: "acc-1", name: "Conta", institution: "Banco", type: "checking", group: "bank", balance: 2500, projectedBalance: 2400, isPrimary: true, includeInTotal: true, createdAt: "2026-01-01" }],
    cards: [{ id: "card-1", name: "Cartão", institution: "Banco", lastFourDigits: "1234", createdAt: "2026-01-01", status: "active", limit: 5000, usedLimit: 1000 }],
    cardInvoices: [{ id: "inv-1", cardId: "card-1", referenceLabel: "Jul/2026", dueDate: "2026-08-10", status: "open", amount: 1000, closingDate: "2026-08-03" }],
    cardPurchases: [{ id: "buy-1", cardId: "card-1", currentInstallment: 1, installments: 2, date: "2026-07-29", totalAmount: 300, description: "Compra" }],
    payables: [{ id: "pay-1", dueDate: "2026-08-01", description: "Energia", category: "Casa", accountId: "acc-1", status: "pending", recurrence: "monthly", amount: 180, paidAmount: 0, notes: "" }],
    receivables: [{ id: "rec-1", expectedDate: "2026-08-05", description: "Projeto", source: "Cliente", payer: "Ateliux", category: "Serviços", accountId: "acc-1", status: "pending", recurrence: "none", amount: 1800, receivedAmount: 0, notes: "" }],
    categories: [{ id: "cat-1", name: "Alimentação", type: "expense", active: true, description: "" }],
    monthlyBudgets: [{ id: "budget-1", categoryId: "cat-1", month: "2026-07", limit: 1000, alertThreshold: 80 }],
    goals: [{ id: "goal-1", name: "Reserva", kind: "reserve", category: "Segurança", accountId: "acc-1", targetDate: "2026-12-31", status: "active", targetAmount: 10000, currentAmount: 2000, monthlyContribution: 500, description: "" }],
    goalContributions: [{ id: "con-1", goalId: "goal-1", type: "deposit", accountId: "acc-1", date: "2026-07-29", amount: 500, note: "" }],
    debts: [{ id: "debt-1", name: "Empréstimo", creditor: "Banco", type: "loan", accountId: "acc-1", nextDueDate: "2026-08-15", status: "active", originalAmount: 5000, currentBalance: 4000, annualInterestRate: 12, installmentAmount: 500, notes: "" }],
    debtPayments: [{ id: "dp-1", debtId: "debt-1", accountId: "acc-1", date: "2026-07-15", amount: 500, principal: 450, interest: 50, note: "" }],
    subscriptions: [{ id: "sub-1", name: "Software", provider: "Ateliux", category: "Trabalho", accountId: "acc-1", nextChargeDate: "2026-08-20", status: "active", billingCycle: "monthly", amount: 99.9, notes: "" }],
    subscriptionCharges: [{ id: "charge-1", subscriptionId: "sub-1", accountId: "acc-1", date: "2026-07-20", status: "paid", amount: 99.9, note: "" }],
  } as unknown as FinancialExportData;
}

describe("exportação", () => {
  it("filtra lançamentos por período", () => {
    const data = exportData();
    data.transactions.push({ ...data.transactions[0], id: "tx-2", date: "2026-06-01" });

    const table = buildExportTable("transactions", "2026-07-01", "2026-07-31", data);
    expect(table.rows).toHaveLength(1);
    expect(table.rows[0][0]).toBe("tx-1");
  });

  it("gera todas as nove tabelas financeiras", () => {
    const tables = buildAllExportTables("", "", exportData());

    expect(tables.map((item) => item.dataset)).toEqual([
      "transactions", "accounts", "cards", "payables", "receivables", "budgets", "goals", "debts", "subscriptions",
    ]);
    expect(tables.every((item) => item.table.rows.length > 0)).toBe(true);
  });

  it("converte tabela para registros e CSV protegido por BOM", () => {
    const table = {
      fileBase: "teste",
      headers: ["Descrição", "Valor"],
      rows: [["Texto; com separador", 125.9], ['Texto com "aspas"', -20]],
    };

    expect(tableToRecords(table)).toEqual([
      { Descrição: "Texto; com separador", Valor: 125.9 },
      { Descrição: 'Texto com "aspas"', Valor: -20 },
    ]);
    expect(tableToCsv(table, ";", true)).toBe(
      '\uFEFFDescrição;Valor\r\n"Texto; com separador";125.9\r\n"Texto com ""aspas""";-20',
    );
  });

  it("identifica a versão da cópia completa da fase 8", () => {
    expect(buildFullBackup(exportData()).version).toBe("0.8.0-regressao");
  });
});
