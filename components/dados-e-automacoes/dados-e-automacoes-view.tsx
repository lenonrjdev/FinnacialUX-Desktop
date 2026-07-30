"use client";

import { useEffect, useMemo, useState } from "react";
import { DataToolsHeading } from "@/components/dados-e-automacoes/data-tools-heading";
import { DataToolsSummary } from "@/components/dados-e-automacoes/data-tools-summary";
import { DataToolsToolbar } from "@/components/dados-e-automacoes/data-tools-toolbar";
import { ExportPanel } from "@/components/dados-e-automacoes/export-panel";
import { ImportHistory } from "@/components/dados-e-automacoes/import-history";
import { ImportPanel } from "@/components/dados-e-automacoes/import-panel";
import { ImportPreview } from "@/components/dados-e-automacoes/import-preview";
import { PortabilityPanel } from "@/components/dados-e-automacoes/portability-panel";
import { RuleDialog } from "@/components/dados-e-automacoes/rule-dialog";
import { RulesPanel } from "@/components/dados-e-automacoes/rules-panel";
import { CheckIcon } from "@/components/shared/icons";
import { useDesktopSecurity } from "@/components/providers/desktop-security-provider";
import { useFinanceDataState, useFinanceDataStatus } from "@/components/providers/finance-data-provider";
import { dataToolsContent } from "@/content/dados-e-automacoes";
import { initialAccounts } from "@/data/contas";
import { transactionsData } from "@/data/lancamentos";
import { initialCreditCards, initialCardInvoices, initialCardPurchases } from "@/data/cartoes";
import { initialPayables } from "@/data/contas-a-pagar";
import { initialReceivables } from "@/data/recebimentos";
import { initialGoals, initialGoalContributions } from "@/data/metas";
import { initialDebts, initialDebtPayments } from "@/data/dividas";
import { initialSubscriptions, initialSubscriptionCharges } from "@/data/assinaturas";
import { dataToolsReferenceDate, initialAutomationRules, initialImportHistory } from "@/data/dados-e-automacoes";
import { initialCategories, initialMonthlyBudgets } from "@/data/orcamentos";
import {
  buildAllExportTables,
  buildExportTable,
  buildFullBackup,
  buildImportRows,
  inferCsvMapping,
  parseCsvFile,
  reviewImportRow,
  tableToCsv,
  tableToRecords,
  testAutomationRules,
} from "@/lib/data-tools";
import { chooseAndWriteUserFile, encodeUtf8 } from "@/lib/desktop/file-transfer";
import {
  applyPortabilityDocuments,
  getWorkspaceDocuments,
  recordPortabilityOperation,
} from "@/lib/desktop/portability";
import { sha256Hex } from "@/lib/portable-package";
import { buildSpreadsheetFile } from "@/lib/spreadsheet";
import type {
  AutomationRule,
  AutomationRuleInput,
  CsvField,
  CsvMapping,
  DataToolsView,
  ExportConfiguration,
  ImportHistoryItem,
  ImportParseResult,
  ImportTransactionRow,
  RuleTestResult,
} from "@/types/dados-e-automacoes";
import type { FinancialTransaction } from "@/types/lancamentos";

export default function DadosEAutomacoesView() {
  const { confirmSensitiveAction } = useDesktopSecurity();
  const { reload } = useFinanceDataStatus();
  const [view, setView] = useState<DataToolsView>("import");
  const [parsed, setParsed] = useState<ImportParseResult | null>(null);
  const [mapping, setMapping] = useState<CsvMapping>({});
  const [rows, setRows] = useState<ImportTransactionRow[]>([]);
  const [rules, setRules] = useFinanceDataState<AutomationRule[]>("automation-rules", initialAutomationRules);
  const [history] = useFinanceDataState<ImportHistoryItem[]>("import-history", initialImportHistory);
  const [transactions] = useFinanceDataState<FinancialTransaction[]>("transactions", transactionsData);
  const [cards] = useFinanceDataState("credit-cards", initialCreditCards);
  const [cardInvoices] = useFinanceDataState("card-invoices", initialCardInvoices);
  const [cardPurchases] = useFinanceDataState("card-purchases", initialCardPurchases);
  const [payables] = useFinanceDataState("payables", initialPayables);
  const [receivables] = useFinanceDataState("receivables", initialReceivables);
  const [goals] = useFinanceDataState("goals", initialGoals);
  const [goalContributions] = useFinanceDataState("goal-contributions", initialGoalContributions);
  const [debts] = useFinanceDataState("debts", initialDebts);
  const [debtPayments] = useFinanceDataState("debt-payments", initialDebtPayments);
  const [subscriptions] = useFinanceDataState("subscriptions", initialSubscriptions);
  const [subscriptionCharges] = useFinanceDataState("subscription-charges", initialSubscriptionCharges);
  const [monthlyBudgets] = useFinanceDataState("monthly-budgets", initialMonthlyBudgets);
  const [storedCategories] = useFinanceDataState("categories", initialCategories);
  const [storedAccounts] = useFinanceDataState("accounts", initialAccounts);
  const [testResults, setTestResults] = useState<RuleTestResult[]>([]);
  const [editingRule, setEditingRule] = useState<AutomationRule | null>(null);
  const [ruleDialogOpen, setRuleDialogOpen] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [operationBusy, setOperationBusy] = useState(false);
  const [exportConfiguration, setExportConfiguration] = useState<ExportConfiguration>({
    dataset: "transactions",
    format: "csv",
    separator: ";",
    startDate: "2026-01-01",
    endDate: dataToolsReferenceDate,
    includeHeaders: true,
  });

  const categories = useMemo(() => storedCategories.filter((item) => item.active).map((item) => item.name), [storedCategories]);
  const accounts = useMemo(() => storedAccounts.map((item) => item.name), [storedAccounts]);
  const financialData = useMemo(() => ({
    transactions,
    accounts: storedAccounts,
    cards,
    cardInvoices,
    cardPurchases,
    payables,
    receivables,
    categories: storedCategories,
    monthlyBudgets,
    goals,
    goalContributions,
    debts,
    debtPayments,
    subscriptions,
    subscriptionCharges,
  }), [cardInvoices, cardPurchases, cards, debtPayments, debts, goalContributions, goals, monthlyBudgets, payables, receivables, storedAccounts, storedCategories, subscriptionCharges, subscriptions, transactions]);
  const activeRules = rules.filter((rule) => rule.active).length;
  const exportPreview = useMemo(() => exportConfiguration.dataset === "full-backup"
    ? null
    : buildExportTable(exportConfiguration.dataset, exportConfiguration.startDate, exportConfiguration.endDate, financialData), [exportConfiguration, financialData]);

  useEffect(() => {
    setTestResults(testAutomationRules(rules, rows, transactions));
  }, [rows, rules, transactions]);

  function showFeedback(message: string) {
    setFeedback(message);
    window.setTimeout(() => setFeedback(""), 3200);
  }

  function updateRows(nextParsed: ImportParseResult, nextMapping: CsvMapping, nextRules = rules) {
    setRows(buildImportRows(nextParsed.records, nextMapping, nextRules, transactions));
  }

  function handleParsed(result: ImportParseResult) {
    const inferred = inferCsvMapping(result.headers);
    setParsed(result);
    setMapping(inferred);
    updateRows(result, inferred);
    setView("import");
  }

  function loadSample() {
    handleParsed(parseCsvFile(dataToolsContent.import.sampleCsv, dataToolsContent.import.sampleFileName));
  }

  function clearImport() {
    setParsed(null);
    setMapping({});
    setRows([]);
  }

  function updateMapping(header: string, field: CsvField) {
    const next = { ...mapping, [header]: field };
    setMapping(next);
    if (parsed) updateRows(parsed, next);
  }

  function updateRow(id: string, patch: Partial<ImportTransactionRow>) {
    setRows((current) => current.map((row) => row.id === id
      ? reviewImportRow({ ...row, ...patch, selected: true }, transactions)
      : row));
  }

  async function importSelected() {
    if (!parsed || operationBusy) return;
    const selectedRows = rows.filter((row) => row.selected && row.status !== "duplicate");
    if (!selectedRows.length) {
      showFeedback(dataToolsContent.feedback.noSelection);
      return;
    }
    setOperationBusy(true);
    try {
      const operationId = `port-${crypto.randomUUID()}`;
      const duplicateRows = rows.filter((row) => row.status === "duplicate").length;
      const ignoredRows = Math.max(rows.length - selectedRows.length - duplicateRows, 0);
      const importedAt = new Date().toISOString();
      const importedTransactions: FinancialTransaction[] = selectedRows.map((row, index) => ({
        id: `imported-${crypto.randomUUID()}-${index}`,
        description: row.description,
        category: row.category,
        account: row.account,
        paymentMethod: "Importação",
        date: row.date,
        amount: row.amount,
        type: row.type,
        status: "completed",
        note: `Importado de ${parsed.fileName}`,
      }));
      const nextHistory: ImportHistoryItem = {
        id: `import-${crypto.randomUUID()}`,
        operationId,
        fileName: parsed.fileName,
        sourceType: parsed.sourceType,
        importedAt,
        importedRows: selectedRows.length,
        ignoredRows,
        duplicateRows,
        status: ignoredRows || duplicateRows ? "partial" : "completed",
        reversible: true,
      };
      const documents = await getWorkspaceDocuments();
      const currentTransactions = Array.isArray(documents.transactions)
        ? documents.transactions as FinancialTransaction[]
        : transactions;
      const currentHistory = Array.isArray(documents["import-history"])
        ? documents["import-history"] as ImportHistoryItem[]
        : history;
      const nextDocuments = {
        ...documents,
        transactions: [...importedTransactions, ...currentTransactions],
        "import-history": [nextHistory, ...currentHistory],
      };
      await applyPortabilityDocuments({
        documents: nextDocuments,
        mode: "replace",
        operation: {
          id: operationId,
          direction: "import",
          format: parsed.sourceType,
          dataset: "transactions",
          fileName: parsed.fileName,
          recordsTotal: rows.length,
          recordsApplied: selectedRows.length,
          recordsRejected: ignoredRows + duplicateRows,
          affectedModules: ["transactions", "import-history"],
          status: ignoredRows || duplicateRows ? "partial" : "completed",
        },
      });
      await reload();
      clearImport();
      showFeedback(dataToolsContent.feedback.imported);
    } catch (caught) {
      showFeedback(caught instanceof Error ? caught.message : "Não foi possível concluir a importação.");
    } finally {
      setOperationBusy(false);
    }
  }

  async function exportData(forceBackup = false) {
    if (operationBusy || !(await confirmSensitiveAction("export"))) return;
    setOperationBusy(true);
    try {
      const configuration: ExportConfiguration = forceBackup
        ? { ...exportConfiguration, dataset: "full-backup", format: "json" }
        : exportConfiguration;
      let bytes: Uint8Array;
      let fileName: string;
      let mimeType: string;
      let recordsTotal = 0;
      let affectedModules: string[] = [];
      if (configuration.dataset === "full-backup") {
        if (configuration.format === "xlsx") {
          const tables = buildAllExportTables(configuration.startDate, configuration.endDate, financialData);
          bytes = await buildSpreadsheetFile(tables.map((item) => ({ name: item.name, table: item.table })));
          recordsTotal = tables.reduce((total, item) => total + item.table.rows.length, 0);
          affectedModules = tables.map((item) => item.dataset);
          fileName = `FinnacialUX-exportacao-completa-${dataToolsReferenceDate}.xlsx`;
          mimeType = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
        } else {
          const backup = buildFullBackup(financialData);
          bytes = encodeUtf8(`${JSON.stringify(backup, null, 2)}\n`);
          recordsTotal = Object.values(backup).reduce((total, value) => total + (Array.isArray(value) ? value.length : 0), 0);
          affectedModules = Object.keys(backup);
          fileName = `backup-financeiro-${dataToolsReferenceDate}.json`;
          mimeType = "application/json;charset=utf-8";
        }
      } else {
        const table = buildExportTable(configuration.dataset, configuration.startDate, configuration.endDate, financialData);
        recordsTotal = table.rows.length;
        affectedModules = [configuration.dataset];
        if (configuration.format === "csv") {
          bytes = encodeUtf8(tableToCsv(table, configuration.separator, configuration.includeHeaders));
          fileName = `${table.fileBase}-${dataToolsReferenceDate}.csv`;
          mimeType = "text/csv;charset=utf-8";
        } else if (configuration.format === "xlsx") {
          bytes = await buildSpreadsheetFile([{ name: dataToolsContent.export.datasets[configuration.dataset], table }]);
          fileName = `${table.fileBase}-${dataToolsReferenceDate}.xlsx`;
          mimeType = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
        } else {
          bytes = encodeUtf8(`${JSON.stringify(tableToRecords(table), null, 2)}\n`);
          fileName = `${table.fileBase}-${dataToolsReferenceDate}.json`;
          mimeType = "application/json;charset=utf-8";
        }
      }
      const extension = fileName.split(".").at(-1) ?? configuration.format;
      const destination = await chooseAndWriteUserFile({
        bytes,
        defaultFileName: fileName,
        filters: [{ name: `Arquivo ${extension.toUpperCase()}`, extensions: [extension] }],
        mimeType,
      });
      if (!destination) return;
      await recordPortabilityOperation({
        direction: "export",
        format: extension,
        dataset: configuration.dataset,
        fileName,
        checksumSha256: await sha256Hex(bytes),
        recordsTotal,
        recordsApplied: recordsTotal,
        affectedModules,
      });
      showFeedback(dataToolsContent.feedback.exported);
    } catch (caught) {
      showFeedback(caught instanceof Error ? caught.message : "Não foi possível exportar os dados.");
    } finally {
      setOperationBusy(false);
    }
  }

  function openNewRule() {
    setEditingRule(null);
    setRuleDialogOpen(true);
  }

  function submitRule(input: AutomationRuleInput) {
    let nextRules: AutomationRule[];
    if (editingRule) {
      nextRules = rules.map((rule) => rule.id === editingRule.id ? { ...rule, ...input } : rule);
      showFeedback(dataToolsContent.feedback.ruleUpdated);
    } else {
      nextRules = [...rules, {
        ...input,
        id: `rule-${Date.now()}`,
        priority: rules.length + 1,
        createdAt: dataToolsReferenceDate,
      }];
      showFeedback(dataToolsContent.feedback.ruleCreated);
    }
    setRules(nextRules);
    setTestResults(testAutomationRules(nextRules, rows, transactions));
    if (parsed) updateRows(parsed, mapping, nextRules);
    setRuleDialogOpen(false);
    setEditingRule(null);
  }

  function toggleRule(rule: AutomationRule) {
    const nextRules = rules.map((item) => item.id === rule.id ? { ...item, active: !item.active } : item);
    setRules(nextRules);
    setTestResults(testAutomationRules(nextRules, rows, transactions));
    if (parsed) updateRows(parsed, mapping, nextRules);
  }

  function deleteRule(rule: AutomationRule) {
    const nextRules = rules.filter((item) => item.id !== rule.id).map((item, index) => ({ ...item, priority: index + 1 }));
    setRules(nextRules);
    setTestResults(testAutomationRules(nextRules, rows, transactions));
    if (parsed) updateRows(parsed, mapping, nextRules);
    showFeedback(dataToolsContent.feedback.ruleRemoved);
  }

  function moveRule(rule: AutomationRule, direction: -1 | 1) {
    const ordered = [...rules].sort((a, b) => a.priority - b.priority);
    const currentIndex = ordered.findIndex((item) => item.id === rule.id);
    const targetIndex = currentIndex + direction;
    if (targetIndex < 0 || targetIndex >= ordered.length) return;
    [ordered[currentIndex], ordered[targetIndex]] = [ordered[targetIndex], ordered[currentIndex]];
    const nextRules = ordered.map((item, index) => ({ ...item, priority: index + 1 }));
    setRules(nextRules);
    if (parsed) updateRows(parsed, mapping, nextRules);
  }

  function runRuleTest() {
    setTestResults(testAutomationRules(rules, rows, transactions));
    showFeedback(dataToolsContent.feedback.rulesTested);
  }

  return (
    <div className="financial-management-page data-tools-page">
      <DataToolsHeading onSample={loadSample} onBackup={() => void exportData(true)} />
      <DataToolsSummary previewRows={rows.length} activeRules={activeRules} history={history} />
      <DataToolsToolbar view={view} onChange={setView} />

      {view === "import" ? (
        <div className="import-workspace">
          <ImportPanel parsed={parsed} mapping={mapping} onParsed={handleParsed} onMappingChange={updateMapping} onClear={clearImport} />
          <ImportPreview
            rows={rows}
            onChange={updateRow}
            onToggle={(id) => setRows((current) => current.map((row) => row.id === id ? { ...row, selected: !row.selected } : row))}
            onSelectAll={() => setRows((current) => current.map((row) => ({ ...row, selected: row.status !== "duplicate" })))}
            onClearSelection={() => setRows((current) => current.map((row) => ({ ...row, selected: false })))}
            onImport={() => void importSelected()}
          />
        </div>
      ) : null}

      {view === "export" ? <ExportPanel configuration={exportConfiguration} preview={exportPreview} onChange={(patch) => setExportConfiguration((current) => ({ ...current, ...patch }))} onExport={() => void exportData()} /> : null}

      {view === "portability" ? (
        <PortabilityPanel
          financialData={financialData}
          startDate={exportConfiguration.startDate}
          endDate={exportConfiguration.endDate}
          onReload={reload}
          onFeedback={showFeedback}
        />
      ) : null}

      {view === "rules" ? (
        <RulesPanel
          rules={rules}
          testResults={testResults}
          onCreate={openNewRule}
          onEdit={(rule) => { setEditingRule(rule); setRuleDialogOpen(true); }}
          onToggle={toggleRule}
          onDelete={deleteRule}
          onMove={moveRule}
          onTest={runRuleTest}
        />
      ) : null}

      {view === "history" ? <ImportHistory history={history} /> : null}

      {ruleDialogOpen ? <RuleDialog editing={editingRule} categories={categories} accounts={accounts} onClose={() => { setRuleDialogOpen(false); setEditingRule(null); }} onSubmit={submitRule} /> : null}

      {feedback ? <div className="transaction-feedback data-tools-feedback"><CheckIcon />{feedback}</div> : null}
    </div>
  );
}
