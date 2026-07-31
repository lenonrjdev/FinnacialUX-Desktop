import { describe, expect, it } from "vitest";
import {
  buildLocalClosurePreview,
  buildLocalReconciliationPreview,
  calculateClosureMovements,
  createStatementFingerprint,
  prepareStatementEntries,
  scoreStatementMatch,
} from "@/lib/reconciliation-engine";
import type { FinancialTransaction } from "@/types/lancamentos";
import type { ImportParseResult } from "@/types/dados-e-automacoes";

const transactions: FinancialTransaction[] = [
  {
    id: "transaction-1",
    description: "Mercado Central",
    category: "Alimentação",
    account: "Nome legado",
    accountId: "account-1",
    paymentMethod: "Débito",
    date: "2026-07-10",
    amount: 120.5,
    type: "expense",
    status: "completed",
  },
  {
    id: "transaction-2",
    description: "Salário mensal",
    category: "Receita",
    account: "Nome legado",
    accountId: "account-1",
    paymentMethod: "PIX",
    date: "2026-07-05",
    amount: 5000,
    type: "income",
    status: "completed",
  },
];

const parsed: ImportParseResult = {
  sourceType: "csv",
  fileName: "extrato.csv",
  headers: ["Data", "Descrição", "Valor", "Tipo"],
  records: [
    { Data: "10/07/2026", Descrição: "Mercado Central", Valor: "-120,50", Tipo: "Débito" },
    { Data: "05/07/2026", Descrição: "Salário mensal", Valor: "5.000,00", Tipo: "Crédito" },
  ],
};

describe("motor local de conciliação", () => {
  it("prepara entradas e gera fingerprints estáveis", () => {
    const first = prepareStatementEntries(parsed);
    const second = prepareStatementEntries(parsed);
    expect(first).toHaveLength(2);
    expect(first[0].direction).toBe("expense");
    expect(first[1].direction).toBe("income");
    expect(first.map((item) => item.fingerprint)).toEqual(second.map((item) => item.fingerprint));
  });

  it("considera valor, data, descrição e conta na correspondência", () => {
    const entry = prepareStatementEntries(parsed)[0];
    const option = scoreStatementMatch(entry, transactions[0], "account-1", "Conta principal");
    expect(option?.transactionId).toBe("transaction-1");
    expect(option?.score).toBeGreaterThanOrEqual(85);
    expect(option?.reasons.amount).toBe("Valor exato");
  });

  it("não combina receita com despesa", () => {
    const entry = prepareStatementEntries(parsed)[0];
    expect(scoreStatementMatch(entry, transactions[1], "account-1", "Conta principal")).toBeNull();
  });

  it("gera prévia determinística e recomenda vínculos confiáveis", async () => {
    const entries = prepareStatementEntries(parsed);
    const first = await buildLocalReconciliationPreview({
      accountId: "account-1",
      accountName: "Conta principal",
      fileName: parsed.fileName,
      sourceType: "csv",
      entries,
      transactions,
    });
    const second = await buildLocalReconciliationPreview({
      accountId: "account-1",
      accountName: "Conta principal",
      fileName: parsed.fileName,
      sourceType: "csv",
      entries,
      transactions,
    });
    expect(first.sourceChecksum).toBe(second.sourceChecksum);
    expect(first.previewChecksum).toBe(second.previewChecksum);
    expect(first.summary.suggestedMatches).toBe(2);
  });

  it("marca uma repetição do extrato como duplicidade", async () => {
    const [entry] = prepareStatementEntries(parsed);
    const preview = await buildLocalReconciliationPreview({
      accountId: "account-1",
      accountName: "Conta principal",
      fileName: parsed.fileName,
      sourceType: "csv",
      entries: [entry, { ...entry, id: "repeat" }],
      transactions: [],
    });
    expect(preview.summary.duplicates).toBe(1);
    expect(preview.entries[1].suggestedAction).toBe("ignore");
  });

  it("calcula movimentos da conta sem misturar outras contas", () => {
    const movements = calculateClosureMovements(
      [
        ...transactions,
        {
          ...transactions[0],
          id: "other",
          account: "Outra conta",
          accountId: "account-2",
          amount: 900,
        },
      ],
      "account-1",
      "Conta principal",
      "2026-07",
    );
    expect(movements.income).toBe(5000);
    expect(movements.expenses).toBe(120.5);
    expect(movements.net).toBe(4879.5);
  });

  it("reconhece transferência recebida pelo identificador da conta de destino", () => {
    const transfer: FinancialTransaction = {
      id: "transfer-1",
      description: "Transferência entre contas",
      category: "Transferência",
      account: "Conta de origem",
      accountId: "account-origin",
      destinationAccount: "Nome legado da conta de destino",
      destinationAccountId: "account-1",
      paymentMethod: "Transferência",
      date: "2026-07-15",
      amount: 250,
      type: "transfer",
      status: "completed",
    };
    const movements = calculateClosureMovements(
      [transfer],
      "account-1",
      "Conta principal",
      "2026-07",
    );
    expect(movements.transfersIn).toBe(250);
    expect(movements.transfersOut).toBe(0);
    expect(movements.net).toBe(250);
  });

  it("só libera fechamento com saldo, itens e checklist consistentes", async () => {
    const checklist = {
      statementImported: true,
      allEntriesResolved: true,
      balanceReviewed: true,
      pendingCommitmentsReviewed: true,
      evidenceReviewed: true,
    };
    const ready = await buildLocalClosurePreview({
      accountId: "account-1",
      accountName: "Conta principal",
      month: "2026-07",
      openingBalance: 1000,
      statementBalance: 5879.5,
      checklist,
      transactions,
    });
    expect(ready.canClose).toBe(true);
    const blocked = await buildLocalClosurePreview({
      accountId: "account-1",
      accountName: "Conta principal",
      month: "2026-07",
      openingBalance: 1000,
      statementBalance: 5800,
      checklist: { ...checklist, evidenceReviewed: false },
      transactions,
      unresolvedEntries: 1,
    });
    expect(blocked.canClose).toBe(false);
    expect(blocked.blockers.length).toBeGreaterThanOrEqual(3);
  });

  it("inclui o identificador externo no fingerprint", () => {
    const base = {
      postedAt: "2026-07-10",
      description: "PIX",
      amount: 10,
      direction: "expense" as const,
    };
    expect(createStatementFingerprint({ ...base, externalId: "A" }))
      .not.toBe(createStatementFingerprint({ ...base, externalId: "B" }));
  });
});
