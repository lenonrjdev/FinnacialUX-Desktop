import { buildImportRows, inferCsvMapping, normalizeDate, parseMoney } from "@/lib/data-tools";
import { sha256Hex, stableStringify } from "@/lib/portable-package";
import type { FinancialTransaction } from "@/types/lancamentos";
import type { CsvField, CsvMapping, ImportParseResult, RawImportRecord } from "@/types/dados-e-automacoes";
import type {
  ClosureChecklist,
  ClosureMovementSummary,
  MonthlyClosurePreview,
  ReconciliationEntryPreview,
  ReconciliationMatchOption,
  ReconciliationPreview,
  ReconciliationSourceType,
  StatementEntryInput,
} from "@/types/reconciliation";

export function normalizeReconciliationText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function moneyToCents(value: number): number {
  return Math.round((Number.isFinite(value) ? value : 0) * 100);
}

function valueByField(record: RawImportRecord, mapping: CsvMapping, field: CsvField): string {
  const header = Object.keys(mapping).find((key) => mapping[key] === field);
  return header ? record[header] ?? "" : "";
}

function inferDirection(rawType: string, amount: number): "income" | "expense" {
  const normalized = normalizeReconciliationText(rawType);
  if (/credit|receita|entrada|deposito|pix recebido/.test(normalized)) return "income";
  if (/debit|despesa|saida|pagamento|saque/.test(normalized)) return "expense";
  return amount >= 0 ? "income" : "expense";
}

export function createStatementFingerprint(input: Pick<StatementEntryInput, "externalId" | "postedAt" | "description" | "amount" | "direction">): string {
  return [
    input.externalId?.trim() || "sem-id",
    input.postedAt,
    normalizeReconciliationText(input.description),
    moneyToCents(Math.abs(input.amount)),
    input.direction,
  ].join("|");
}

export function prepareStatementEntries(
  parseResult: ImportParseResult,
  mapping: CsvMapping = inferCsvMapping(parseResult.headers),
): StatementEntryInput[] {
  const rows = buildImportRows(parseResult.records, mapping, [], []);
  return rows.map((row, index) => {
    const original = parseResult.records[index] ?? {};
    const rawAmount = parseMoney(valueByField(original, mapping, "amount"));
    const rawType = valueByField(original, mapping, "type");
    const externalId = Object.entries(original).find(([key]) => /fitid|identificador|id transacao|documento/i.test(key))?.[1]?.trim();
    const postedAt = normalizeDate(valueByField(original, mapping, "date")) || row.date;
    const direction = inferDirection(rawType, rawAmount || (row.type === "income" ? row.amount : -row.amount));
    const entry: StatementEntryInput = {
      id: `statement-entry-${index}-${externalId || normalizeReconciliationText(row.description).slice(0, 24) || "item"}`,
      externalId: externalId || undefined,
      postedAt,
      description: row.description.trim(),
      amount: Math.abs(row.amount),
      direction,
      memo: Object.entries(original).find(([key]) => /memo|historico|observacao/i.test(key))?.[1]?.trim() || undefined,
      fingerprint: "",
    };
    entry.fingerprint = createStatementFingerprint(entry);
    return entry;
  });
}

function dateDistance(left: string, right: string): number {
  const a = Date.parse(`${left}T12:00:00.000Z`);
  const b = Date.parse(`${right}T12:00:00.000Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return 999;
  return Math.round(Math.abs(a - b) / 86_400_000);
}

function tokenSimilarity(left: string, right: string): number {
  const a = new Set(normalizeReconciliationText(left).split(" ").filter((token) => token.length > 1));
  const b = new Set(normalizeReconciliationText(right).split(" ").filter((token) => token.length > 1));
  if (!a.size || !b.size) return 0;
  const intersection = [...a].filter((token) => b.has(token)).length;
  return intersection / Math.max(a.size, b.size);
}

export function scoreStatementMatch(
  entry: StatementEntryInput,
  transaction: FinancialTransaction,
  accountId: string,
  accountName: string,
  dateToleranceDays = 2,
  amountToleranceCents = 1,
): ReconciliationMatchOption | null {
  const expectedType = entry.direction === "income" ? "income" : "expense";
  if (transaction.type !== expectedType) return null;
  const amountDifference = Math.abs(moneyToCents(transaction.amount) - moneyToCents(entry.amount));
  if (amountDifference > amountToleranceCents) return null;
  const days = dateDistance(entry.postedAt, transaction.date);
  if (days > dateToleranceDays) return null;

  const amountScore = amountDifference === 0 ? 55 : 48;
  const dateScore = days === 0 ? 25 : days === 1 ? 18 : 12;
  const similarity = tokenSimilarity(entry.description, transaction.description);
  const descriptionScore = Math.round(similarity * 15);
  const transactionAccounts = [transaction.accountId, transaction.account].filter(Boolean).map((value) => normalizeReconciliationText(value ?? ""));
  const accountMatches = [accountId, accountName]
    .filter(Boolean)
    .some((value) => transactionAccounts.includes(normalizeReconciliationText(value)));
  const accountScore = accountMatches ? 5 : 0;
  const score = Math.min(100, amountScore + dateScore + descriptionScore + accountScore);

  return {
    transactionId: transaction.id,
    transactionDescription: transaction.description,
    transactionDate: transaction.date,
    transactionAmount: transaction.amount,
    score,
    reasons: {
      amount: amountDifference === 0 ? "Valor exato" : `Diferença de ${amountDifference} centavo(s)`,
      date: days === 0 ? "Mesma data" : `${days} dia(s) de diferença`,
      description: similarity >= 0.7 ? "Descrição muito semelhante" : similarity > 0 ? "Descrição parcialmente semelhante" : "Descrição diferente",
      account: accountMatches ? "Mesma conta" : "Conta não identificada no lançamento",
    },
  };
}

export async function buildLocalReconciliationPreview(input: {
  accountId: string;
  accountName: string;
  fileName: string;
  sourceType: ReconciliationSourceType;
  entries: StatementEntryInput[];
  transactions: FinancialTransaction[];
  dateToleranceDays?: number;
  amountToleranceCents?: number;
  autoMatchThreshold?: number;
}): Promise<ReconciliationPreview> {
  const seen = new Set<string>();
  const threshold = input.autoMatchThreshold ?? 85;
  const previews: ReconciliationEntryPreview[] = input.entries.map((entry) => {
    const duplicate = seen.has(entry.fingerprint)
      || input.transactions.some((transaction) => transaction.sourceId === (entry.externalId || entry.id));
    seen.add(entry.fingerprint);
    const options = input.transactions
      .map((transaction) => scoreStatementMatch(
        entry,
        transaction,
        input.accountId,
        input.accountName,
        input.dateToleranceDays,
        input.amountToleranceCents,
      ))
      .filter((option): option is ReconciliationMatchOption => Boolean(option))
      .sort((a, b) => b.score - a.score)
      .slice(0, 3);
    const best = options[0];
    const runnerUp = options[1];
    const confident = Boolean(best && best.score >= threshold && (!runnerUp || best.score - runnerUp.score >= 8));
    return {
      entry,
      status: duplicate ? "duplicate" : confident ? "ready" : options.length ? "review" : "ready",
      suggestedAction: duplicate ? "ignore" : confident ? "match" : "create",
      suggestedTransactionId: confident ? best.transactionId : undefined,
      options,
      issues: duplicate ? ["Possível duplicidade no extrato ou em uma importação anterior."] : confident ? [] : options.length ? ["Há mais de uma correspondência possível; revise antes de aplicar."] : [],
    };
  });
  const dates = input.entries.map((entry) => entry.postedAt).filter(Boolean).sort();
  const sourcePayload = {
    accountId: input.accountId,
    entries: [...input.entries].sort((a, b) => a.id.localeCompare(b.id)),
  };
  const sourceChecksum = await sha256Hex(stableStringify(sourcePayload));
  const previewChecksum = await sha256Hex(stableStringify({ sourceChecksum, previews }));
  return {
    sourceChecksum,
    previewChecksum,
    accountId: input.accountId,
    accountName: input.accountName,
    fileName: input.fileName,
    sourceType: input.sourceType,
    periodStart: dates.at(0) ?? "",
    periodEnd: dates.at(-1) ?? "",
    entries: previews,
    summary: {
      entries: previews.length,
      suggestedMatches: previews.filter((item) => item.suggestedAction === "match").length,
      newTransactions: previews.filter((item) => item.suggestedAction === "create").length,
      duplicates: previews.filter((item) => item.status === "duplicate").length,
      needsReview: previews.filter((item) => item.status === "review").length,
      totalIncome: input.entries.filter((item) => item.direction === "income").reduce((total, item) => total + item.amount, 0),
      totalExpenses: input.entries.filter((item) => item.direction === "expense").reduce((total, item) => total + item.amount, 0),
    },
  };
}

export function calculateClosureMovements(
  transactions: FinancialTransaction[],
  accountId: string,
  accountName: string,
  month: string,
): ClosureMovementSummary {
  const aliases = new Set([accountId, accountName].filter(Boolean).map(normalizeReconciliationText));
  const current = transactions.filter((transaction) => transaction.date.startsWith(month));
  let income = 0;
  let expenses = 0;
  let transfersIn = 0;
  let transfersOut = 0;
  let count = 0;
  for (const transaction of current) {
    const sourceMatches = [transaction.accountId, transaction.account]
      .filter(Boolean)
      .some((value) => aliases.has(normalizeReconciliationText(value ?? "")));
    const destinationMatches = [transaction.destinationAccountId, transaction.destinationAccount]
      .filter(Boolean)
      .some((value) => aliases.has(normalizeReconciliationText(value ?? "")));
    if (transaction.type === "income" && sourceMatches) { income += transaction.amount; count += 1; }
    else if (transaction.type === "expense" && sourceMatches) { expenses += transaction.amount; count += 1; }
    else if (transaction.type === "transfer") {
      if (sourceMatches) { transfersOut += transaction.amount; count += 1; }
      if (destinationMatches) { transfersIn += transaction.amount; count += 1; }
    }
  }
  return {
    income,
    expenses,
    transfersIn,
    transfersOut,
    net: income + transfersIn - expenses - transfersOut,
    transactions: count,
  };
}

export async function buildLocalClosurePreview(input: {
  accountId: string;
  accountName: string;
  month: string;
  openingBalance: number;
  statementBalance: number;
  checklist: ClosureChecklist;
  transactions: FinancialTransaction[];
  unresolvedEntries?: number;
  closingToleranceCents?: number;
}): Promise<MonthlyClosurePreview> {
  const movements = calculateClosureMovements(input.transactions, input.accountId, input.accountName, input.month);
  const calculatedBalance = input.openingBalance + movements.net;
  const difference = input.statementBalance - calculatedBalance;
  const checklistComplete = Object.values(input.checklist).every(Boolean);
  const unresolvedEntries = input.unresolvedEntries ?? 0;
  const blockers: string[] = [];
  if (Math.abs(moneyToCents(difference)) > (input.closingToleranceCents ?? 1)) blockers.push("O saldo do extrato ainda diverge do saldo calculado.");
  if (unresolvedEntries > 0) blockers.push("Existem itens do extrato sem decisão de conciliação.");
  if (!checklistComplete) blockers.push("Conclua todos os itens do checklist de fechamento.");
  const sourceChecksum = await sha256Hex(stableStringify({
    accountId: input.accountId,
    month: input.month,
    openingBalance: input.openingBalance,
    statementBalance: input.statementBalance,
    checklist: input.checklist,
    transactions: input.transactions.filter((item) => item.date.startsWith(input.month)).sort((a, b) => a.id.localeCompare(b.id)),
  }));
  return {
    accountId: input.accountId,
    accountName: input.accountName,
    month: input.month,
    openingBalance: input.openingBalance,
    movements,
    calculatedBalance,
    statementBalance: input.statementBalance,
    difference,
    unresolvedEntries,
    checklist: input.checklist,
    sourceChecksum,
    canClose: blockers.length === 0,
    blockers,
  };
}
