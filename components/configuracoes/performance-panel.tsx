"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  benchmarkTransactionPages,
  cancelPerformanceOperation,
  getDatabasePerformanceHealth,
  getPerformancePreferences,
  listPerformanceMetrics,
  listPerformanceOperations,
  listTransactionsPage,
  listenPerformanceProgress,
  rebuildTransactionIndex,
  runDatabaseMaintenance,
  savePerformancePreferences,
} from "@/lib/desktop/performance";
import { databaseHealthLabel } from "@/lib/performance-engine";
import type {
  DatabasePerformanceHealth,
  PerformanceMetric,
  PerformanceOperation,
  PerformancePreferences,
  PerformanceProgressEvent,
  TransactionBenchmarkResult,
  TransactionPage,
  TransactionPageFilters,
} from "@/types/performance";

const initialFilters: TransactionPageFilters = {
  page: 1,
  pageSize: 50,
  search: "",
  type: "all",
  status: "all",
};

function formatBytes(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const index = Math.min(units.length - 1, Math.floor(Math.log(value) / Math.log(1024)));
  return `${(value / 1024 ** index).toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}

function formatDate(value?: string | null): string {
  if (!value) return "Ainda não executado";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString("pt-BR");
}

function formatMoney(value: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

export function PerformancePanel({ onFeedback }: { onFeedback: (message: string) => void }) {
  const [preferences, setPreferences] = useState<PerformancePreferences | null>(null);
  const [health, setHealth] = useState<DatabasePerformanceHealth | null>(null);
  const [operations, setOperations] = useState<PerformanceOperation[]>([]);
  const [metrics, setMetrics] = useState<PerformanceMetric[]>([]);
  const [benchmark, setBenchmark] = useState<TransactionBenchmarkResult | null>(null);
  const [page, setPage] = useState<TransactionPage | null>(null);
  const [filters, setFilters] = useState<TransactionPageFilters>(initialFilters);
  const [progress, setProgress] = useState<PerformanceProgressEvent | null>(null);
  const [busy, setBusy] = useState(false);

  const refreshOverview = useCallback(async () => {
    const [nextPreferences, nextHealth, nextOperations, nextMetrics] = await Promise.all([
      getPerformancePreferences(),
      getDatabasePerformanceHealth(),
      listPerformanceOperations(20),
      listPerformanceMetrics(20),
    ]);
    setPreferences(nextPreferences);
    setHealth(nextHealth);
    setOperations(nextOperations);
    setMetrics(nextMetrics);
    setFilters((current) => ({ ...current, pageSize: current.pageSize ?? nextPreferences.transactionPageSize }));
  }, []);

  const loadPage = useCallback(async (nextFilters: TransactionPageFilters) => {
    const result = await listTransactionsPage(nextFilters);
    setPage(result);
    setFilters((current) => ({ ...current, page: result.page, pageSize: result.pageSize }));
  }, []);

  useEffect(() => {
    void refreshOverview().then(() => loadPage(initialFilters)).catch((error) => {
      onFeedback(error instanceof Error ? error.message : String(error));
    });
  }, [loadPage, onFeedback, refreshOverview]);

  useEffect(() => {
    let unlisten: (() => void) | undefined;
    void listenPerformanceProgress((event) => {
      setProgress(event);
      if (event.status === "completed" || event.status === "cancelled" || event.status === "failed") {
        void refreshOverview();
      }
    }).then((dispose) => { unlisten = dispose; }).catch(() => undefined);
    return () => unlisten?.();
  }, [refreshOverview]);

  const activeOperation = useMemo(
    () => operations.find((operation) => operation.status === "running" || operation.status === "queued"),
    [operations],
  );
  const healthStatus = health ? databaseHealthLabel(health) : "attention";

  async function runAction(action: () => Promise<void>, success: string) {
    setBusy(true);
    try {
      await action();
      await refreshOverview();
      onFeedback(success);
    } catch (error) {
      onFeedback(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  }

  async function savePreferences() {
    if (!preferences) return;
    await runAction(async () => {
      const saved = await savePerformancePreferences({
        transactionPageSize: preferences.transactionPageSize,
        importBatchSize: preferences.importBatchSize,
        queryTimeoutMs: preferences.queryTimeoutMs,
        autoAnalyze: preferences.autoAnalyze,
      });
      setPreferences(saved);
      await loadPage({ ...filters, page: 1, pageSize: saved.transactionPageSize });
    }, "Preferências de desempenho atualizadas.");
  }

  async function runBenchmark() {
    await runAction(async () => {
      const result = await benchmarkTransactionPages();
      setBenchmark(result);
    }, "Benchmark local concluído.");
  }

  return (
    <section className="settings-panel performance-panel" aria-labelledby="performance-title">
      <div className="settings-panel-heading">
        <div>
          <p className="settings-eyebrow">Base local</p>
          <h2 id="performance-title">Desempenho e grandes volumes</h2>
          <p>Paginação nativa, índice derivado, importações em lotes e manutenção sem telemetria externa.</p>
        </div>
        <span className={`performance-health-badge ${healthStatus}`}>
          {healthStatus === "healthy" ? "Saudável" : healthStatus === "maintenance" ? "Manutenção recomendada" : "Operação em andamento"}
        </span>
      </div>

      <div className="performance-kpi-grid">
        <article><span>Banco SQLCipher</span><strong>{formatBytes(health?.databaseSizeBytes ?? 0)}</strong><small>Schema {health?.schemaVersion ?? "—"}</small></article>
        <article><span>Índice pesquisável</span><strong>{health?.transactionIndexRows ?? 0}</strong><small>lançamentos indexados</small></article>
        <article><span>Espaço reutilizável</span><strong>{health?.reusablePercent ?? 0}%</strong><small>{formatBytes(health?.reusableBytes ?? 0)}</small></article>
        <article><span>Última análise</span><strong>{health?.lastAnalyzeAt ? "Concluída" : "Pendente"}</strong><small>{formatDate(health?.lastAnalyzeAt)}</small></article>
      </div>

      {progress ? (
        <div className="performance-progress" role="status">
          <div><strong>{progress.message}</strong><span>{progress.current}/{progress.total}</span></div>
          <progress max={100} value={progress.percent}>{progress.percent}%</progress>
        </div>
      ) : null}

      <div className="performance-section-grid">
        <article className="settings-card performance-settings-card">
          <div className="settings-card-heading"><div><h3>Limites operacionais</h3><p>Valores maiores processam mais itens por lote; valores menores usam menos memória.</p></div></div>
          {preferences ? (
            <div className="performance-form-grid">
              <label>Página de lançamentos<input type="number" min={25} max={250} value={preferences.transactionPageSize} onChange={(event) => setPreferences({ ...preferences, transactionPageSize: Number(event.target.value) })} /></label>
              <label>Lote de importação<input type="number" min={100} max={2000} step={100} value={preferences.importBatchSize} onChange={(event) => setPreferences({ ...preferences, importBatchSize: Number(event.target.value) })} /></label>
              <label>Meta de consulta (ms)<input type="number" min={50} max={10000} step={50} value={preferences.queryTimeoutMs} onChange={(event) => setPreferences({ ...preferences, queryTimeoutMs: Number(event.target.value) })} /></label>
              <label className="performance-checkbox"><input type="checkbox" checked={preferences.autoAnalyze} onChange={(event) => setPreferences({ ...preferences, autoAnalyze: event.target.checked })} />Executar análise automática quando necessário</label>
              <button className="settings-primary-button" type="button" disabled={busy} onClick={() => void savePreferences()}>Salvar limites</button>
            </div>
          ) : <p>Carregando preferências…</p>}
        </article>

        <article className="settings-card performance-actions-card">
          <div className="settings-card-heading"><div><h3>Índice e manutenção</h3><p>O índice é derivado dos documentos financeiros e pode ser reconstruído sem perda de dados.</p></div></div>
          <div className="performance-action-list">
            <button type="button" disabled={busy || Boolean(activeOperation)} onClick={() => void runAction(async () => { const operation = await rebuildTransactionIndex(); if (operation.status === "cancelled") throw new Error("A reconstrução foi cancelada."); await loadPage({ ...filters, page: 1 }); }, "Índice reconstruído com sucesso.")}>Reconstruir índice</button>
            <button type="button" disabled={busy || Boolean(activeOperation)} onClick={() => void runAction(async () => { const result = await runDatabaseMaintenance(); setHealth(result.health); }, "ANALYZE, optimize e checkpoint concluídos.")}>Executar manutenção</button>
            <button type="button" disabled={busy} onClick={() => void runBenchmark()}>Medir paginação</button>
            {activeOperation ? <button className="danger" type="button" onClick={() => void cancelPerformanceOperation(activeOperation.id)}>Cancelar operação</button> : null}
          </div>
          {benchmark ? (
            <div className={`performance-benchmark ${benchmark.withinTarget ? "passed" : "attention"}`}>
              <strong>{benchmark.averagePageMs.toFixed(2)} ms</strong>
              <span>Média entre primeira e última página · meta {benchmark.targetMs} ms</span>
            </div>
          ) : null}
        </article>
      </div>

      <article className="settings-card performance-browser-card">
        <div className="settings-card-heading"><div><h3>Navegador paginado</h3><p>Os filtros são executados no índice SQLCipher; a interface recebe somente a página solicitada.</p></div></div>
        <form className="performance-filter-grid" onSubmit={(event) => { event.preventDefault(); void loadPage({ ...filters, page: 1 }); }}>
          <label>Buscar<input value={filters.search ?? ""} onChange={(event) => setFilters({ ...filters, search: event.target.value })} placeholder="Descrição, categoria ou conta" /></label>
          <label>Tipo<select value={filters.type ?? "all"} onChange={(event) => setFilters({ ...filters, type: event.target.value as TransactionPageFilters["type"] })}><option value="all">Todos</option><option value="income">Entradas</option><option value="expense">Saídas</option><option value="transfer">Transferências</option></select></label>
          <label>De<input type="date" value={filters.dateFrom ?? ""} onChange={(event) => setFilters({ ...filters, dateFrom: event.target.value || undefined })} /></label>
          <label>Até<input type="date" value={filters.dateTo ?? ""} onChange={(event) => setFilters({ ...filters, dateTo: event.target.value || undefined })} /></label>
          <button type="submit" disabled={busy}>Aplicar filtros</button>
        </form>

        <div className="performance-table-wrap">
          <table className="performance-table">
            <thead><tr><th>Data</th><th>Descrição</th><th>Conta</th><th>Categoria</th><th>Valor</th></tr></thead>
            <tbody>
              {page?.items.length ? page.items.map((transaction) => (
                <tr key={transaction.id}>
                  <td>{transaction.date}</td><td>{transaction.description}</td><td>{transaction.account}</td><td>{transaction.category}</td>
                  <td className={transaction.type === "income" ? "positive" : transaction.type === "expense" ? "negative" : ""}>{formatMoney(transaction.amount)}</td>
                </tr>
              )) : <tr><td colSpan={5}>Nenhum lançamento encontrado.</td></tr>}
            </tbody>
          </table>
        </div>
        <div className="performance-pagination">
          <span>{page ? `${page.totalItems} itens · página ${page.page} de ${page.totalPages} · ${page.durationMs} ms` : "Carregando…"}</span>
          <div><button type="button" disabled={!page || page.page <= 1} onClick={() => void loadPage({ ...filters, page: Math.max(1, (page?.page ?? 1) - 1) })}>Anterior</button><button type="button" disabled={!page || page.page >= page.totalPages} onClick={() => void loadPage({ ...filters, page: Math.min(page?.totalPages ?? 1, (page?.page ?? 1) + 1) })}>Próxima</button></div>
        </div>
      </article>

      <div className="performance-section-grid">
        <article className="settings-card"><div className="settings-card-heading"><div><h3>Operações recentes</h3><p>Progresso, cancelamentos e falhas ficam registrados somente neste dispositivo.</p></div></div><div className="performance-log-list">{operations.length ? operations.slice(0, 8).map((operation) => <div key={operation.id}><strong>{operation.kind}</strong><span>{operation.status} · {operation.progressCurrent}/{operation.progressTotal}</span></div>) : <p>Nenhuma operação registrada.</p>}</div></article>
        <article className="settings-card"><div className="settings-card-heading"><div><h3>Métricas locais</h3><p>Duração e quantidade processada, sem valores ou descrições financeiras.</p></div></div><div className="performance-log-list">{metrics.length ? metrics.slice(0, 8).map((metric) => <div key={metric.id}><strong>{metric.operationType}</strong><span>{metric.itemCount} itens · {metric.durationMs} ms</span></div>) : <p>Nenhuma métrica registrada.</p>}</div></article>
      </div>
    </section>
  );
}
