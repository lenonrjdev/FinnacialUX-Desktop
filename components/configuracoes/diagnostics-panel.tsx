"use client";

import { useCallback, useEffect, useState } from "react";
import { DiagnosticChecksPanel } from "@/components/configuracoes/diagnostic-checks-panel";
import { DiagnosticHistoryPanel } from "@/components/configuracoes/diagnostic-history-panel";
import { DiagnosticRepairsPanel } from "@/components/configuracoes/diagnostic-repairs-panel";
import { useDesktopSecurity } from "@/components/providers/desktop-security-provider";
import {
  ArchiveIcon,
  CheckIcon,
  CopyIcon,
  DatabaseIcon,
  DownloadIcon,
  FileCheckIcon,
  KeyIcon,
  RefreshIcon,
  ShieldIcon,
  WarningIcon,
} from "@/components/shared/icons";
import {
  applyDiagnosticRepair,
  chooseSupportPackageDestination,
  chooseSupportPackageSource,
  exportSupportPackage,
  getClientDiagnosticContext,
  listDiagnosticRepairs,
  listDiagnosticRuns,
  previewDiagnosticSuite,
  runDiagnosticSuite,
  validateSupportPackage,
} from "@/lib/desktop/diagnostics";
import {
  diagnosticHealthLabel,
  formatDiagnosticSummary,
  recommendedRepairs,
} from "@/lib/diagnostic-engine";
import { formatFileSize, formatSettingsDateTime } from "@/lib/settings";
import type {
  ClientDiagnosticContext,
  DiagnosticRepairAction,
  DiagnosticRepairRecord,
  DiagnosticRunSummary,
  DiagnosticSuiteResult,
  SupportPackageResult,
  SupportPackageValidation,
} from "@/types/diagnostics";

const healthText = {
  healthy: "Ambiente saudável",
  attention: "Revisão recomendada",
  failed: "Atenção necessária",
};

export function DiagnosticsPanel({ onFeedback }: { onFeedback: (message: string) => void }) {
  const { confirmSensitiveAction } = useDesktopSecurity();
  const [suite, setSuite] = useState<DiagnosticSuiteResult | null>(null);
  const [context, setContext] = useState<ClientDiagnosticContext | null>(null);
  const [runs, setRuns] = useState<DiagnosticRunSummary[]>([]);
  const [repairs, setRepairs] = useState<DiagnosticRepairRecord[]>([]);
  const [lastPackage, setLastPackage] = useState<SupportPackageResult | null>(null);
  const [validation, setValidation] = useState<SupportPackageValidation | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const refreshHistory = useCallback(async () => {
    const [nextRuns, nextRepairs] = await Promise.all([
      listDiagnosticRuns(20),
      listDiagnosticRepairs(20),
    ]);
    setRuns(nextRuns);
    setRepairs(nextRepairs);
  }, []);

  const loadPreview = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const nextContext = await getClientDiagnosticContext();
      const [nextSuite] = await Promise.all([
        previewDiagnosticSuite({
          includeReadWriteTest: false,
          includeRestoreDrill: false,
          clientContext: nextContext,
        }),
        refreshHistory(),
      ]);
      setContext(nextContext);
      setSuite(nextSuite);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setLoading(false);
    }
  }, [refreshHistory]);

  useEffect(() => {
    void loadPreview();
  }, [loadPreview]);

  const health = suite
    ? diagnosticHealthLabel(suite.score, suite.checksFailed, suite.checksAttention)
    : "attention";
  const availableRepairs = suite ? recommendedRepairs(suite.checks) : [];

  async function runFullAudit() {
    if (!context || !(await confirmSensitiveAction("security"))) return;
    setBusy(true);
    setError("");
    try {
      const result = await runDiagnosticSuite({
        includeReadWriteTest: true,
        includeRestoreDrill: true,
        clientContext: context,
      });
      setSuite(result);
      await refreshHistory();
      onFeedback(result.persisted
        ? "Auditoria local concluída e registrada."
        : "Auditoria concluída sem gravação porque o modo somente leitura está ativo.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setBusy(false);
    }
  }

  async function runRepair(action: DiagnosticRepairAction) {
    if (!suite || !(await confirmSensitiveAction("security"))) return;
    setBusy(true);
    setError("");
    try {
      const result = await applyDiagnosticRepair(action, suite.persisted ? suite.id : undefined);
      onFeedback(result.resultSummary);
      await loadPreview();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setBusy(false);
    }
  }

  async function exportPackage() {
    if (!context || !(await confirmSensitiveAction("export"))) return;
    const destination = await chooseSupportPackageDestination();
    if (!destination) return;
    setBusy(true);
    setError("");
    try {
      const result = await exportSupportPackage(destination, context, true);
      setLastPackage(result);
      onFeedback(`Pacote de suporte exportado: ${result.fileName}`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setBusy(false);
    }
  }

  async function validatePackage() {
    const source = await chooseSupportPackageSource();
    if (!source) return;
    setBusy(true);
    setError("");
    try {
      const result = await validateSupportPackage(source);
      setValidation(result);
      onFeedback(result.message);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setBusy(false);
    }
  }

  async function copySummary() {
    if (!suite) return;
    try {
      await navigator.clipboard.writeText(formatDiagnosticSummary(suite));
      onFeedback("Resumo técnico copiado sem dados financeiros.");
    } catch {
      setError("O navegador não permitiu copiar o resumo técnico.");
    }
  }

  if (loading) {
    return (
      <section className="settings-panel diagnostic-loading-card">
        <RefreshIcon />
        <span>Verificando SQLCipher, cofre, pastas e continuidade...</span>
      </section>
    );
  }

  if (!suite) {
    return (
      <section className="settings-panel diagnostic-error-card">
        <WarningIcon />
        <div><strong>Não foi possível carregar o diagnóstico.</strong><span>{error}</span></div>
        <button type="button" className="secondary-action-button" onClick={() => void loadPreview()}>Tentar novamente</button>
      </section>
    );
  }

  const categoryPassed = (prefix: string) => suite.checks.some(
    (check) => check.code.startsWith(prefix) && check.status === "passed",
  );

  return (
    <div className="diagnostics-v2-layout">
      <section className="settings-panel diagnostics-command-center">
        <div className="diagnostics-command-heading">
          <div>
            <span className="section-eyebrow">Auditoria local e suporte</span>
            <h2>Central de diagnóstico</h2>
            <p>Valide banco, cofre, backups, restauração, rotinas e atualizações sem enviar dados para servidores.</p>
          </div>
          <div className="diagnostic-command-actions">
            <button type="button" className="secondary-action-button" disabled={busy} onClick={() => void loadPreview()}><RefreshIcon /> Atualizar</button>
            <button type="button" className="primary-action-button" disabled={busy} onClick={() => void runFullAudit()}><FileCheckIcon /> {busy ? "Executando..." : "Auditoria completa"}</button>
          </div>
        </div>

        <div className={`diagnostic-score-card ${health}`}>
          <div className="diagnostic-score-ring"><strong>{suite.score}</strong><span>/100</span></div>
          <div>
            <span>{healthText[health]}</span>
            <h3>{suite.checksPassed} verificações aprovadas</h3>
            <p>{suite.checksAttention} precisam de atenção e {suite.checksFailed} falharam.</p>
          </div>
          <small>{suite.persisted ? `Registrado em ${formatSettingsDateTime(suite.completedAt)}` : "Prévia sem alterar o banco"}</small>
        </div>

        <div className="diagnostic-capability-grid">
          <article className={categoryPassed("database.encryption") ? "healthy" : "attention"}><DatabaseIcon /><div><small>SQLCipher</small><strong>{categoryPassed("database.encryption") ? "Confirmado" : "Revisar"}</strong><span>schema 14 e integridade</span></div></article>
          <article className={categoryPassed("security.stronghold") ? "healthy" : "attention"}><KeyIcon /><div><small>Stronghold</small><strong>{categoryPassed("security.stronghold") ? "Disponível" : "Parcial"}</strong><span>segredos nunca exportados</span></div></article>
          <article className={categoryPassed("continuity.restore_drill") ? "healthy" : "neutral"}><ArchiveIcon /><div><small>Restauração</small><strong>{categoryPassed("continuity.restore_drill") ? "Ensaio aprovado" : "Ainda não ensaiada"}</strong><span>snapshot temporário</span></div></article>
          <article className={categoryPassed("updates.channel") ? "healthy" : "attention"}><ShieldIcon /><div><small>Atualizações</small><strong>{categoryPassed("updates.channel") ? "Configuradas" : "Revisar canal"}</strong><span>assinatura e endpoint</span></div></article>
        </div>

        {suite.readOnly ? (
          <div className="diagnostic-read-only-note"><ShieldIcon /><span>A auditoria permanece disponível, mas histórico e reparos não são gravados no modo somente leitura.</span></div>
        ) : null}
        {error ? <div className="diagnostic-inline-error"><WarningIcon /> {error}</div> : null}
      </section>

      <div className="diagnostics-v2-main-grid">
        <DiagnosticChecksPanel suite={suite} />
        <div className="diagnostics-v2-side-stack">
          <section className="settings-panel diagnostic-support-panel">
            <header className="settings-panel-header compact">
              <div><span className="section-eyebrow">Atendimento seguro</span><h2>Pacote de suporte</h2><p>Inclui apenas versões, contagens, verificações e logs sanitizados.</p></div>
            </header>
            <div className="diagnostic-privacy-list">
              <span><CheckIcon /> Sem senhas ou chaves</span>
              <span><CheckIcon /> Sem saldos ou lançamentos</span>
              <span><CheckIcon /> SHA-256 verificável</span>
            </div>
            <div className="diagnostic-support-actions">
              <button type="button" className="primary-action-button" disabled={busy} onClick={() => void exportPackage()}><DownloadIcon /> Exportar pacote</button>
              <button type="button" className="secondary-action-button" disabled={busy} onClick={() => void validatePackage()}><FileCheckIcon /> Validar pacote</button>
              <button type="button" className="text-action-button" onClick={() => void copySummary()}><CopyIcon /> Copiar resumo</button>
            </div>
            {lastPackage ? (
              <div className="diagnostic-package-result">
                <strong>{lastPackage.fileName}</strong>
                <span>{formatFileSize(lastPackage.packageSizeBytes)} · {lastPackage.checksCount} verificações</span>
                <code>{lastPackage.payloadSha256}</code>
              </div>
            ) : null}
            {validation ? (
              <div className={`diagnostic-package-validation ${validation.valid ? "valid" : "invalid"}`}>
                {validation.valid ? <CheckIcon /> : <WarningIcon />}
                <div><strong>{validation.valid ? "Pacote íntegro" : "Pacote inválido"}</strong><span>{validation.message}</span></div>
              </div>
            ) : null}
          </section>

          <DiagnosticRepairsPanel
            actions={availableRepairs}
            records={repairs}
            readOnly={suite.readOnly}
            busy={busy}
            onRepair={(action) => void runRepair(action)}
          />
        </div>
      </div>

      <DiagnosticHistoryPanel runs={runs} />
    </div>
  );
}
