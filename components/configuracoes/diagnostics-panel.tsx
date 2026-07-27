"use client";

import { useEffect, useState } from "react";
import {
  ArchiveIcon,
  CheckIcon,
  DatabaseIcon,
  DownloadIcon,
  HistoryIcon,
  RefreshIcon,
  WarningIcon,
} from "@/components/shared/icons";
import {
  chooseDiagnosticDestination,
  exportDiagnosticPackage,
  getDesktopDiagnostics,
  openDesktopFolder,
  runDatabaseIntegrityCheck,
} from "@/lib/desktop/protection";
import { formatFileSize, formatSettingsDateTime } from "@/lib/settings";
import type { DiagnosticReport } from "@/types/desktop-protection";

export function DiagnosticsPanel({ onFeedback }: { onFeedback: (message: string) => void }) {
  const [report, setReport] = useState<DiagnosticReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState("");

  async function refresh() {
    setLoading(true);
    setError("");
    try {
      setReport(await getDesktopDiagnostics());
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  async function verify() {
    setChecking(true);
    setError("");
    try {
      const integrity = await runDatabaseIntegrityCheck();
      setReport((current) => current ? { ...current, integrity } : current);
      onFeedback(integrity.ok ? "O banco local passou em todas as verificações." : "A verificação encontrou um problema no banco local.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setChecking(false);
    }
  }

  async function exportPackage() {
    const destination = await chooseDiagnosticDestination();
    if (!destination) return;
    try {
      const path = await exportDiagnosticPackage(destination);
      onFeedback(`Diagnóstico exportado em ${path}`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    }
  }

  if (loading) {
    return <section className="settings-panel diagnostic-loading-card"><RefreshIcon /><span>Verificando o ambiente local...</span></section>;
  }

  if (!report) {
    return (
      <section className="settings-panel diagnostic-error-card">
        <WarningIcon />
        <div><strong>Não foi possível carregar o diagnóstico.</strong><span>{error}</span></div>
        <button type="button" className="secondary-action-button" onClick={() => void refresh()}>Tentar novamente</button>
      </section>
    );
  }

  return (
    <div className="diagnostics-layout">
      <section className="settings-panel diagnostics-main-panel">
        <header className="settings-panel-header diagnostic-panel-header">
          <div>
            <span className="section-eyebrow">Ambiente local</span>
            <h2>Diagnóstico do FinnacialUX</h2>
            <p>Consulte a integridade do banco, versões instaladas e caminhos usados pelo aplicativo sem expor informações financeiras.</p>
          </div>
          <div className="diagnostic-header-actions">
            <button type="button" className="secondary-action-button" onClick={() => void refresh()}><RefreshIcon /> Atualizar</button>
            <button type="button" className="primary-action-button" onClick={() => void verify()} disabled={checking}><DatabaseIcon /> {checking ? "Verificando..." : "Verificar banco"}</button>
          </div>
        </header>

        <div className={`diagnostic-integrity-card ${report.integrity.ok ? "ok" : "failed"}`}>
          <span>{report.integrity.ok ? <CheckIcon /> : <WarningIcon />}</span>
          <div>
            <strong>{report.integrity.ok ? "Banco local íntegro" : "Atenção necessária"}</strong>
            <p>{report.integrity.ok
              ? "Estrutura, relacionamentos e tabelas essenciais foram validados."
              : "O banco apresentou inconsistências. Crie um backup e evite novas alterações até revisar a recuperação."}</p>
          </div>
          <small>Verificado em {formatSettingsDateTime(report.integrity.checkedAt)}</small>
        </div>

        <div className="diagnostic-metrics-grid">
          <article><span><DatabaseIcon /></span><div><small>Banco local</small><strong>{formatFileSize(report.databaseSizeBytes)}</strong><p>Schema {report.integrity.schemaVersion}</p></div></article>
          <article><span><ArchiveIcon /></span><div><small>Backups registrados</small><strong>{report.backupCount}</strong><p>{report.lastBackupAt ? `Último em ${formatSettingsDateTime(report.lastBackupAt)}` : "Nenhuma cópia criada"}</p></div></article>
          <article><span><CheckIcon /></span><div><small>Chaves estrangeiras</small><strong>{report.integrity.foreignKeyViolations}</strong><p>{report.integrity.foreignKeyViolations === 0 ? "Sem violações" : "Revisão recomendada"}</p></div></article>
          <article><span><DatabaseIcon /></span><div><small>Espaço livre</small><strong>{formatFileSize(report.availableDiskBytes)}</strong><p>Na unidade dos dados locais</p></div></article>
        </div>

        <div className="diagnostic-system-grid">
          <article><small>Aplicativo</small><strong>{report.appName} {report.appVersion}</strong><span>{report.identifier}</span></article>
          <article><small>Sistema operacional</small><strong>{report.operatingSystem}</strong><span>Arquitetura {report.architecture}</span></article>
          <article><small>Inicialização anterior</small><strong>{report.previousUncleanShutdown ? "Encerramento inesperado detectado" : "Encerramento normal"}</strong><span>{report.safeMode ? "Modo seguro ativo" : "Modo normal"}</span></article>
          <article><small>Tabelas essenciais</small><strong>{report.integrity.requiredTablesPresent ? "Presentes" : "Incompletas"}</strong><span>{report.integrity.integrityMessages.join(", ")}</span></article>
        </div>

        {error ? <div className="diagnostic-inline-error"><WarningIcon /> {error}</div> : null}
      </section>

      <aside className="diagnostics-sidebar">
        <section className="settings-panel diagnostic-paths-card">
          <header className="settings-panel-header compact"><div><span className="section-eyebrow">Pastas protegidas</span><h2>Arquivos locais</h2><p>Abra somente os diretórios controlados pelo FinnacialUX.</p></div></header>
          <div className="diagnostic-path-list">
            <button type="button" onClick={() => void openDesktopFolder("data")}><DatabaseIcon /><span><strong>Pasta de dados</strong><small>{report.databasePath}</small></span></button>
            <button type="button" onClick={() => void openDesktopFolder("backups")}><ArchiveIcon /><span><strong>Pasta de backups</strong><small>{report.backupsDirectory}</small></span></button>
            <button type="button" onClick={() => void openDesktopFolder("logs")}><HistoryIcon /><span><strong>Pasta de logs</strong><small>{report.logsDirectory}</small></span></button>
          </div>
        </section>

        <section className="settings-panel diagnostic-export-card">
          <header className="settings-panel-header compact"><div><span className="section-eyebrow">Suporte</span><h2>Pacote de diagnóstico</h2><p>Exporta versões, integridade e logs sanitizados. Não inclui senhas, saldos ou lançamentos.</p></div></header>
          <button type="button" className="primary-action-button" onClick={() => void exportPackage()}><DownloadIcon /> Exportar diagnóstico</button>
        </section>

        <section className="settings-panel migration-history-card">
          <header className="settings-panel-header compact"><div><span className="section-eyebrow">Banco local</span><h2>Histórico de schema</h2></div></header>
          <div className="migration-history-list">
            {report.migrations.map((migration) => (
              <article key={migration.version}>
                <span>v{migration.version}</span>
                <div><strong>{migration.description}</strong><small>{formatSettingsDateTime(migration.appliedAt)}</small></div>
              </article>
            ))}
          </div>
        </section>
      </aside>
    </div>
  );
}
