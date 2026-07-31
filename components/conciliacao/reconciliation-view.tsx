"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArchiveIcon,
  CheckIcon,
  DownloadIcon,
  FileCheckIcon,
  FileIcon,
  HistoryIcon,
  RefreshIcon,
  ShieldIcon,
  TrashIcon,
  UploadIcon,
  WarningIcon,
} from "@/components/shared/icons";
import { useFinanceDataState, useFinanceDataStatus } from "@/components/providers/finance-data-provider";
import { reconciliationContent } from "@/content/reconciliation";
import { initialAccounts } from "@/data/contas";
import { transactionsData } from "@/data/lancamentos";
import { inferCsvMapping, parseCsvFile, parseOfxFile } from "@/lib/data-tools";
import { chooseAndReadUserFile, chooseAndWriteUserFile, decodeUtf8 } from "@/lib/desktop/file-transfer";
import { hasTauriRuntime } from "@/lib/desktop/runtime";
import {
  applyReconciliationImport,
  closeFinancialMonth,
  getReconciliationPreferences,
  deleteReconciliationEvidence,
  listMonthlyClosures,
  listReconciliationEvidence,
  listReconciliationImports,
  previewMonthlyClosure,
  previewReconciliationImport,
  readReconciliationEvidence,
  reopenFinancialMonth,
  saveReconciliationEvidence,
  saveReconciliationPreferences,
  undoReconciliationImport,
} from "@/lib/desktop/reconciliation";
import { prepareStatementEntries } from "@/lib/reconciliation-engine";
import { formatCurrency } from "@/lib/formatters";
import type { FinancialAccount } from "@/types/contas";
import type { FinancialTransaction } from "@/types/lancamentos";
import type {
  ClosureChecklist,
  MonthlyClosure,
  MonthlyClosurePreview,
  ReconciliationDecision,
  ReconciliationEvidence,
  ReconciliationImportRecord,
  ReconciliationPreferences,
  ReconciliationPreview,
  ReconciliationSourceType,
  StatementEntryInput,
} from "@/types/reconciliation";

type View = "reconcile" | "closing" | "history" | "evidence";

type StatementFile = {
  name: string;
  sourceType: ReconciliationSourceType;
  entries: StatementEntryInput[];
};

const initialPreferences: ReconciliationPreferences = {
  workspaceId: "",
  dateToleranceDays: 2,
  amountToleranceCents: 1,
  autoMatchThreshold: 85,
  closingToleranceCents: 1,
  requirePreviewBeforeApply: true,
  requireCompleteChecklist: true,
  updatedAt: "",
};

const initialChecklist: ClosureChecklist = {
  statementImported: false,
  allEntriesResolved: false,
  balanceReviewed: false,
  pendingCommitmentsReviewed: false,
  evidenceReviewed: false,
};

function currentMonth(): string {
  return new Date().toISOString().slice(0, 7);
}

function numberValue(value: string): number {
  const compact = value.trim().replace(/\s/g, "");
  const normalized = compact.includes(",")
    ? compact.replace(/\./g, "").replace(",", ".")
    : compact;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function mimeTypeFromFileName(fileName?: string): string | undefined {
  const extension = fileName?.split(".").pop()?.toLowerCase();
  return ({
    pdf: "application/pdf",
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    webp: "image/webp",
  } as Record<string, string>)[extension ?? ""];
}

function statusLabel(status: string): string {
  return ({
    applied: "Aplicada",
    partial: "Parcial",
    undone: "Desfeita",
    closed: "Fechado",
    reopened: "Reaberto",
  } as Record<string, string>)[status] ?? status;
}

export default function ReconciliationView() {
  const [view, setView] = useState<View>("reconcile");
  const [accounts] = useFinanceDataState<FinancialAccount[]>("accounts", initialAccounts);
  const [transactions] = useFinanceDataState<FinancialTransaction[]>("transactions", transactionsData);
  const { reload, readOnly, saving } = useFinanceDataStatus();
  const [desktop, setDesktop] = useState(false);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [error, setError] = useState("");

  const [statement, setStatement] = useState<StatementFile | null>(null);
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? "");
  const [openingBalance, setOpeningBalance] = useState("0");
  const [closingBalance, setClosingBalance] = useState("0");
  const [preview, setPreview] = useState<ReconciliationPreview | null>(null);
  const [decisions, setDecisions] = useState<Record<string, ReconciliationDecision>>({});

  const [closureAccountId, setClosureAccountId] = useState(accounts[0]?.id ?? "");
  const [closureMonth, setClosureMonth] = useState(currentMonth());
  const [closureOpeningBalance, setClosureOpeningBalance] = useState("0");
  const [closureStatementBalance, setClosureStatementBalance] = useState("0");
  const [checklist, setChecklist] = useState<ClosureChecklist>(initialChecklist);
  const [closurePreview, setClosurePreview] = useState<MonthlyClosurePreview | null>(null);
  const [closureNotes, setClosureNotes] = useState("");

  const [imports, setImports] = useState<ReconciliationImportRecord[]>([]);
  const [closures, setClosures] = useState<MonthlyClosure[]>([]);
  const [evidence, setEvidence] = useState<ReconciliationEvidence[]>([]);
  const [preferences, setPreferences] = useState<ReconciliationPreferences>(initialPreferences);
  const [evidenceTransactionId, setEvidenceTransactionId] = useState("");
  const [evidenceNote, setEvidenceNote] = useState("");

  const selectedAccount = useMemo(
    () => accounts.find((account) => account.id === accountId) ?? accounts[0],
    [accountId, accounts],
  );
  const selectedClosureAccount = useMemo(
    () => accounts.find((account) => account.id === closureAccountId) ?? accounts[0],
    [accounts, closureAccountId],
  );

  const loadPreferences = useCallback(async () => {
    if (!hasTauriRuntime()) return;
    setPreferences(await getReconciliationPreferences());
  }, []);

  const loadHistory = useCallback(async () => {
    if (!hasTauriRuntime()) return;
    const [nextImports, nextClosures, nextEvidence] = await Promise.all([
      listReconciliationImports(),
      listMonthlyClosures(),
      listReconciliationEvidence(),
    ]);
    setImports(nextImports);
    setClosures(nextClosures);
    setEvidence(nextEvidence);
  }, []);

  useEffect(() => {
    const active = hasTauriRuntime();
    setDesktop(active);
    if (active) {
      void loadHistory().catch(() => undefined);
      void loadPreferences().catch(() => undefined);
    }
  }, [loadHistory, loadPreferences]);

  useEffect(() => {
    if (!accountId && accounts[0]) setAccountId(accounts[0].id);
    if (!closureAccountId && accounts[0]) setClosureAccountId(accounts[0].id);
  }, [accountId, accounts, closureAccountId]);

  function showFeedback(message: string) {
    setFeedback(message);
    setError("");
    window.setTimeout(() => setFeedback(""), 5000);
  }

  function showError(caught: unknown) {
    setError(caught instanceof Error ? caught.message : "Não foi possível concluir a operação.");
    setFeedback("");
  }

  async function chooseStatement() {
    setError("");
    const selected = await chooseAndReadUserFile([
      { name: "Extratos financeiros", extensions: ["csv", "ofx"] },
    ], "Selecionar extrato bancário");
    if (!selected) return;
    const extension = selected.name.split(".").pop()?.toLowerCase();
    const text = decodeUtf8(selected.bytes);
    const parsed = extension === "ofx"
      ? parseOfxFile(text, selected.name)
      : parseCsvFile(text, selected.name);
    const mapping = inferCsvMapping(parsed.headers);
    const entries = prepareStatementEntries(parsed, mapping);
    if (!entries.length) throw new Error("O extrato não contém movimentações reconhecíveis.");
    setStatement({
      name: selected.name,
      sourceType: extension === "ofx" ? "ofx" : "csv",
      entries,
    });
    setPreview(null);
    setDecisions({});
  }

  async function persistPreferences() {
    setBusy(true);
    try {
      const saved = await saveReconciliationPreferences({
        dateToleranceDays: preferences.dateToleranceDays,
        amountToleranceCents: preferences.amountToleranceCents,
        autoMatchThreshold: preferences.autoMatchThreshold,
        closingToleranceCents: preferences.closingToleranceCents,
        requirePreviewBeforeApply: true,
        requireCompleteChecklist: preferences.requireCompleteChecklist,
      });
      setPreferences(saved);
      setPreview(null);
      setClosurePreview(null);
      showFeedback(reconciliationContent.feedback.preferencesSaved);
    } catch (caught) {
      showError(caught);
    } finally {
      setBusy(false);
    }
  }

  async function generatePreview() {
    if (!statement || !selectedAccount) return;
    setBusy(true);
    setError("");
    try {
      const next = await previewReconciliationImport({
        accountId: selectedAccount.id,
        accountName: selectedAccount.name,
        fileName: statement.name,
        sourceType: statement.sourceType,
        entries: statement.entries,
      });
      const nextDecisions = Object.fromEntries(next.entries.map((item) => [
        item.entry.id,
        {
          entryId: item.entry.id,
          action: item.suggestedAction,
          transactionId: item.suggestedTransactionId,
        } satisfies ReconciliationDecision,
      ]));
      setPreview(next);
      setDecisions(nextDecisions);
    } catch (caught) {
      showError(caught);
    } finally {
      setBusy(false);
    }
  }

  async function applyPreview() {
    if (!statement || !selectedAccount || !preview) return;
    setBusy(true);
    try {
      await applyReconciliationImport({
        accountId: selectedAccount.id,
        accountName: selectedAccount.name,
        fileName: statement.name,
        sourceType: statement.sourceType,
        entries: statement.entries,
        openingBalance: numberValue(openingBalance),
        closingBalance: numberValue(closingBalance),
        sourceChecksum: preview.sourceChecksum,
        previewChecksum: preview.previewChecksum,
        decisions: preview.entries.map((item) => decisions[item.entry.id] ?? {
          entryId: item.entry.id,
          action: "ignore",
        }),
      });
      await Promise.all([reload(), loadHistory()]);
      setStatement(null);
      setPreview(null);
      setDecisions({});
      showFeedback(reconciliationContent.feedback.applied);
    } catch (caught) {
      showError(caught);
    } finally {
      setBusy(false);
    }
  }

  async function generateClosurePreview() {
    if (!selectedClosureAccount) return;
    setBusy(true);
    try {
      const next = await previewMonthlyClosure({
        accountId: selectedClosureAccount.id,
        accountName: selectedClosureAccount.name,
        month: closureMonth,
        openingBalance: numberValue(closureOpeningBalance),
        statementBalance: numberValue(closureStatementBalance),
        checklist,
      });
      setClosurePreview(next);
    } catch (caught) {
      showError(caught);
    } finally {
      setBusy(false);
    }
  }

  async function closeMonth() {
    if (!selectedClosureAccount || !closurePreview) return;
    setBusy(true);
    try {
      await closeFinancialMonth({
        accountId: selectedClosureAccount.id,
        accountName: selectedClosureAccount.name,
        month: closureMonth,
        openingBalance: numberValue(closureOpeningBalance),
        statementBalance: numberValue(closureStatementBalance),
        checklist,
        sourceChecksum: closurePreview.sourceChecksum,
        notes: closureNotes,
      });
      await loadHistory();
      setClosurePreview(null);
      showFeedback(reconciliationContent.feedback.closed);
    } catch (caught) {
      showError(caught);
    } finally {
      setBusy(false);
    }
  }

  async function undoImport(importId: string) {
    setBusy(true);
    try {
      await undoReconciliationImport(importId);
      await Promise.all([reload(), loadHistory()]);
      showFeedback(reconciliationContent.feedback.undone);
    } catch (caught) {
      showError(caught);
    } finally {
      setBusy(false);
    }
  }

  async function reopenMonth(closure: MonthlyClosure) {
    const reason = window.prompt("Informe o motivo auditável para reabrir este mês:");
    if (!reason?.trim()) return;
    setBusy(true);
    try {
      await reopenFinancialMonth({ closureId: closure.id, reason: reason.trim() });
      await loadHistory();
      showFeedback(reconciliationContent.feedback.reopened);
    } catch (caught) {
      showError(caught);
    } finally {
      setBusy(false);
    }
  }

  async function addEvidence() {
    if (!evidenceTransactionId) {
      setError("Selecione um lançamento para vincular o comprovante.");
      return;
    }
    setBusy(true);
    try {
      const selected = await chooseAndReadUserFile([
        { name: "Comprovantes", extensions: ["pdf", "png", "jpg", "jpeg", "webp"] },
      ], "Selecionar comprovante");
      await saveReconciliationEvidence({
        transactionId: evidenceTransactionId,
        note: evidenceNote,
        fileName: selected?.name,
        mimeType: mimeTypeFromFileName(selected?.name),
        bytes: selected ? Array.from(selected.bytes) : undefined,
      });
      setEvidenceNote("");
      await loadHistory();
      showFeedback(reconciliationContent.feedback.evidenceSaved);
    } catch (caught) {
      showError(caught);
    } finally {
      setBusy(false);
    }
  }

  async function exportEvidence(item: ReconciliationEvidence) {
    setBusy(true);
    try {
      const file = await readReconciliationEvidence(item.id);
      await chooseAndWriteUserFile({
        bytes: Uint8Array.from(file.bytes),
        defaultFileName: file.fileName,
        mimeType: file.mimeType,
        filters: [{
          name: "Comprovante",
          extensions: [file.fileName.split(".").pop()?.toLowerCase() || "bin"],
        }],
        title: "Salvar comprovante protegido",
      });
      showFeedback("Comprovante exportado após validação do checksum.");
    } catch (caught) {
      showError(caught);
    } finally {
      setBusy(false);
    }
  }

  const disabled = busy || saving || readOnly || !desktop;

  return (
    <div className="reconciliation-page">
      <header className="reconciliation-heading">
        <div>
          <span className="section-eyebrow">{reconciliationContent.badge}</span>
          <h1>{reconciliationContent.title}</h1>
          <p>{reconciliationContent.description}</p>
        </div>
        <div className="reconciliation-heading-status">
          <ShieldIcon />
          <span>SQLCipher · schema 10</span>
        </div>
      </header>

      {!desktop ? (
        <section className="reconciliation-notice">
          <WarningIcon />
          <div><strong>Abra esta área no aplicativo Desktop</strong><p>Checksums, fechamento e comprovantes dependem do núcleo Tauri local.</p></div>
        </section>
      ) : null}
      {readOnly ? (
        <section className="reconciliation-notice warning">
          <WarningIcon />
          <div><strong>Modo somente leitura ativo</strong><p>As prévias continuam disponíveis, mas importações, fechamentos e comprovantes estão bloqueados.</p></div>
        </section>
      ) : null}
      {feedback ? <div className="reconciliation-feedback"><CheckIcon />{feedback}</div> : null}
      {error ? <div className="reconciliation-error" role="alert"><WarningIcon />{error}</div> : null}

      <nav className="reconciliation-tabs" aria-label="Áreas da conciliação">
        {(["reconcile", "closing", "history", "evidence"] as View[]).map((item) => (
          <button type="button" className={view === item ? "active" : ""} key={item} onClick={() => setView(item)}>
            {item === "reconcile" ? <FileCheckIcon /> : item === "closing" ? <ArchiveIcon /> : item === "history" ? <HistoryIcon /> : <FileIcon />}
            {reconciliationContent.tabs[item]}
          </button>
        ))}
      </nav>

      {view === "reconcile" ? (
        <div className="reconciliation-grid">
          <section className="reconciliation-panel">
            <div className="reconciliation-panel-heading"><div><span>01</span><h2>Preparar extrato</h2><p>CSV e OFX são processados localmente.</p></div><UploadIcon /></div>
            <div className="reconciliation-form-grid">
              <label><span>Conta</span><select value={accountId} onChange={(event) => { setAccountId(event.target.value); setPreview(null); }}>{accounts.map((account) => <option value={account.id} key={account.id}>{account.name} · {account.institution}</option>)}</select></label>
              <label><span>Saldo inicial</span><input value={openingBalance} onChange={(event) => setOpeningBalance(event.target.value)} inputMode="decimal" /></label>
              <label><span>Saldo final do extrato</span><input value={closingBalance} onChange={(event) => setClosingBalance(event.target.value)} inputMode="decimal" /></label>
            </div>
            <details className="reconciliation-preferences">
              <summary>Critérios de correspondência e fechamento</summary>
              <div className="reconciliation-form-grid">
                <label><span>Tolerância de data</span><input type="number" min={0} max={7} value={preferences.dateToleranceDays} onChange={(event) => setPreferences((current) => ({ ...current, dateToleranceDays: Number(event.target.value) }))} /></label>
                <label><span>Tolerância de valor (centavos)</span><input type="number" min={0} max={1000} value={preferences.amountToleranceCents} onChange={(event) => setPreferences((current) => ({ ...current, amountToleranceCents: Number(event.target.value) }))} /></label>
                <label><span>Confiança mínima</span><input type="number" min={50} max={100} value={preferences.autoMatchThreshold} onChange={(event) => setPreferences((current) => ({ ...current, autoMatchThreshold: Number(event.target.value) }))} /></label>
                <label><span>Tolerância do fechamento</span><input type="number" min={0} max={10000} value={preferences.closingToleranceCents} onChange={(event) => setPreferences((current) => ({ ...current, closingToleranceCents: Number(event.target.value) }))} /></label>
              </div>
              <label className="reconciliation-preference-check"><input type="checkbox" checked={preferences.requireCompleteChecklist} onChange={(event) => setPreferences((current) => ({ ...current, requireCompleteChecklist: event.target.checked }))} /><span>Exigir checklist completo para fechar o mês</span></label>
              <button className="secondary-action-button" type="button" disabled={disabled} onClick={() => void persistPreferences()}><CheckIcon />{reconciliationContent.actions.savePreferences}</button>
            </details>
            <button className="reconciliation-file-button" type="button" onClick={() => void chooseStatement().catch(showError)} disabled={busy}>
              <UploadIcon />
              <span><strong>{statement?.name ?? reconciliationContent.actions.chooseStatement}</strong><small>{statement ? `${statement.entries.length} movimentações reconhecidas` : "Nenhum dado sai do seu computador"}</small></span>
            </button>
            <button className="primary-action-button" type="button" disabled={!statement || busy || !desktop} onClick={() => void generatePreview()}><FileCheckIcon />{busy ? "Analisando..." : reconciliationContent.actions.preview}</button>
          </section>

          <section className="reconciliation-panel reconciliation-preview-panel">
            <div className="reconciliation-panel-heading"><div><span>02</span><h2>Revisar correspondências</h2><p>Valor, data, descrição e conta compõem a pontuação.</p></div><ShieldIcon /></div>
            {!preview ? <div className="reconciliation-empty">{reconciliationContent.empty.preview}</div> : (
              <>
                <div className="reconciliation-summary">
                  <div><small>Itens</small><strong>{preview.summary.entries}</strong></div>
                  <div><small>Correspondências</small><strong>{preview.summary.suggestedMatches}</strong></div>
                  <div><small>Novos</small><strong>{preview.summary.newTransactions}</strong></div>
                  <div><small>Revisão</small><strong>{preview.summary.needsReview}</strong></div>
                </div>
                <div className="reconciliation-entry-list">
                  {preview.entries.map((item) => {
                    const decision = decisions[item.entry.id];
                    return (
                      <article key={item.entry.id} className={`reconciliation-entry ${item.status}`}>
                        <div><strong>{item.entry.description}</strong><small>{item.entry.postedAt} · {item.entry.direction === "income" ? "Entrada" : "Saída"}</small></div>
                        <strong>{formatCurrency(item.entry.amount)}</strong>
                        <select value={decision?.action ?? "ignore"} onChange={(event) => setDecisions((current) => ({ ...current, [item.entry.id]: { entryId: item.entry.id, action: event.target.value as ReconciliationDecision["action"], transactionId: event.target.value === "match" ? item.suggestedTransactionId ?? item.options[0]?.transactionId : undefined } }))}>
                          <option value="match" disabled={!item.options.length}>Vincular existente</option>
                          <option value="create">Criar lançamento</option>
                          <option value="ignore">Ignorar</option>
                        </select>
                        {decision?.action === "match" && item.options.length ? <select value={decision.transactionId ?? item.options[0].transactionId} onChange={(event) => setDecisions((current) => ({ ...current, [item.entry.id]: { ...current[item.entry.id], entryId: item.entry.id, action: "match", transactionId: event.target.value } }))}>{item.options.map((option) => <option value={option.transactionId} key={option.transactionId}>{option.score}% · {option.transactionDescription} · {option.transactionDate}</option>)}</select> : null}
                        {item.issues.map((issue) => <p key={issue}>{issue}</p>)}
                      </article>
                    );
                  })}
                </div>
                <button className="primary-action-button" type="button" disabled={disabled} onClick={() => void applyPreview()}><CheckIcon />{reconciliationContent.actions.apply}</button>
              </>
            )}
          </section>
        </div>
      ) : null}

      {view === "closing" ? (
        <div className="reconciliation-grid">
          <section className="reconciliation-panel">
            <div className="reconciliation-panel-heading"><div><span>01</span><h2>Preparar fechamento</h2><p>Confirme o saldo e todos os itens do período.</p></div><ArchiveIcon /></div>
            <div className="reconciliation-form-grid">
              <label><span>Conta</span><select value={closureAccountId} onChange={(event) => { setClosureAccountId(event.target.value); setClosurePreview(null); }}>{accounts.map((account) => <option value={account.id} key={account.id}>{account.name}</option>)}</select></label>
              <label><span>Mês</span><input type="month" value={closureMonth} onChange={(event) => { setClosureMonth(event.target.value); setClosurePreview(null); }} /></label>
              <label><span>Saldo inicial</span><input value={closureOpeningBalance} onChange={(event) => setClosureOpeningBalance(event.target.value)} /></label>
              <label><span>Saldo do extrato</span><input value={closureStatementBalance} onChange={(event) => setClosureStatementBalance(event.target.value)} /></label>
            </div>
            <div className="reconciliation-checklist">
              {(Object.keys(checklist) as Array<keyof ClosureChecklist>).map((key) => (
                <label key={key}><input type="checkbox" checked={checklist[key]} onChange={(event) => { setChecklist((current) => ({ ...current, [key]: event.target.checked })); setClosurePreview(null); }} /><span>{({ statementImported: "Extrato importado", allEntriesResolved: "Todos os itens resolvidos", balanceReviewed: "Saldo revisado", pendingCommitmentsReviewed: "Pendências revisadas", evidenceReviewed: "Comprovantes revisados" } as Record<keyof ClosureChecklist, string>)[key]}</span></label>
              ))}
            </div>
            <button className="secondary-action-button" type="button" disabled={busy || !desktop} onClick={() => void generateClosurePreview()}><RefreshIcon />Gerar conferência</button>
          </section>
          <section className="reconciliation-panel">
            <div className="reconciliation-panel-heading"><div><span>02</span><h2>Resultado do período</h2><p>O fechamento é recusado enquanto houver divergências.</p></div><FileCheckIcon /></div>
            {!closurePreview ? <div className="reconciliation-empty">Gere a conferência para validar saldo, pendências e checklist.</div> : <>
              <div className="reconciliation-balance-card"><small>Saldo calculado</small><strong>{formatCurrency(closurePreview.calculatedBalance)}</strong><span className={Math.abs(closurePreview.difference) <= 0.01 ? "balanced" : "divergent"}>Diferença: {formatCurrency(closurePreview.difference)}</span></div>
              <div className="reconciliation-summary"><div><small>Entradas</small><strong>{formatCurrency(closurePreview.movements.income)}</strong></div><div><small>Saídas</small><strong>{formatCurrency(closurePreview.movements.expenses)}</strong></div><div><small>Movimentos</small><strong>{closurePreview.movements.transactions}</strong></div></div>
              {closurePreview.blockers.length ? <ul className="reconciliation-blockers">{closurePreview.blockers.map((blocker) => <li key={blocker}><WarningIcon />{blocker}</li>)}</ul> : <div className="reconciliation-ready"><CheckIcon />Período pronto para fechamento.</div>}
              <label className="reconciliation-notes"><span>Observações do fechamento</span><textarea value={closureNotes} onChange={(event) => setClosureNotes(event.target.value)} rows={3} /></label>
              <button className="primary-action-button" type="button" disabled={disabled || !closurePreview.canClose} onClick={() => void closeMonth()}><ArchiveIcon />{reconciliationContent.actions.closeMonth}</button>
            </>}
          </section>
        </div>
      ) : null}

      {view === "history" ? (
        <div className="reconciliation-grid">
          <section className="reconciliation-panel">
            <div className="reconciliation-panel-heading"><div><span>Extratos</span><h2>Importações conciliadas</h2><p>O desfazer exige que o snapshot posterior permaneça intacto.</p></div><HistoryIcon /></div>
            {!imports.length ? <div className="reconciliation-empty">{reconciliationContent.empty.imports}</div> : <div className="reconciliation-history-list">{imports.map((item) => <article key={item.id}><div><strong>{item.fileName}</strong><small>{item.accountName} · {item.periodStart} a {item.periodEnd}</small><span>{item.matchedCount} vinculados · {item.createdCount} criados · {item.ignoredCount} ignorados</span></div><div><span className={`status ${item.status}`}>{statusLabel(item.status)}</span>{item.reversible ? <button type="button" disabled={disabled} onClick={() => void undoImport(item.id)}><RefreshIcon />Desfazer</button> : null}</div></article>)}</div>}
          </section>
          <section className="reconciliation-panel">
            <div className="reconciliation-panel-heading"><div><span>Períodos</span><h2>Fechamentos mensais</h2><p>Reaberturas exigem motivo e permanecem no histórico.</p></div><ArchiveIcon /></div>
            {!closures.length ? <div className="reconciliation-empty">{reconciliationContent.empty.closures}</div> : <div className="reconciliation-history-list">{closures.map((item) => <article key={item.id}><div><strong>{item.month} · {item.accountName}</strong><small>Saldo final {formatCurrency(item.statementBalance)} · diferença {formatCurrency(item.difference)}</small><span>{item.notes || "Sem observações"}</span></div><div><span className={`status ${item.status}`}>{statusLabel(item.status)}</span>{item.status === "closed" ? <button type="button" disabled={disabled} onClick={() => void reopenMonth(item)}><RefreshIcon />Reabrir</button> : null}</div></article>)}</div>}
          </section>
        </div>
      ) : null}

      {view === "evidence" ? (
        <div className="reconciliation-grid">
          <section className="reconciliation-panel">
            <div className="reconciliation-panel-heading"><div><span>Proteção</span><h2>Vincular comprovante</h2><p>Arquivos de até 5 MB são armazenados dentro do banco criptografado.</p></div><ShieldIcon /></div>
            <label className="reconciliation-field"><span>Lançamento</span><select value={evidenceTransactionId} onChange={(event) => setEvidenceTransactionId(event.target.value)}><option value="">Selecione...</option>{transactions.slice().sort((a, b) => b.date.localeCompare(a.date)).map((transaction) => <option value={transaction.id} key={transaction.id}>{transaction.date} · {transaction.description} · {formatCurrency(transaction.amount)}</option>)}</select></label>
            <label className="reconciliation-notes"><span>Observação</span><textarea value={evidenceNote} onChange={(event) => setEvidenceNote(event.target.value)} rows={4} placeholder="Ex.: comprovante de transferência, nota ou justificativa" /></label>
            <button className="primary-action-button" type="button" disabled={disabled || !evidenceTransactionId} onClick={() => void addEvidence()}><UploadIcon />{reconciliationContent.actions.addEvidence}</button>
          </section>
          <section className="reconciliation-panel">
            <div className="reconciliation-panel-heading"><div><span>Arquivo local</span><h2>Comprovantes protegidos</h2><p>O checksum identifica qualquer alteração no conteúdo.</p></div><FileCheckIcon /></div>
            {!evidence.length ? <div className="reconciliation-empty">{reconciliationContent.empty.evidence}</div> : <div className="reconciliation-history-list">{evidence.map((item) => { const transaction = transactions.find((value) => value.id === item.transactionId); return <article key={item.id}><div><strong>{item.fileName ?? "Observação sem arquivo"}</strong><small>{transaction?.description ?? item.transactionId}</small><span>{item.note || `${item.sizeBytes} bytes`}</span></div><div className="reconciliation-evidence-actions">{item.fileName ? <button type="button" disabled={busy || !desktop} onClick={() => void exportEvidence(item)}><DownloadIcon />Exportar</button> : null}<button type="button" disabled={disabled} onClick={() => void deleteReconciliationEvidence(item.id).then(loadHistory).catch(showError)}><TrashIcon />Remover</button></div></article>; })}</div>}
          </section>
        </div>
      ) : null}
    </div>
  );
}
