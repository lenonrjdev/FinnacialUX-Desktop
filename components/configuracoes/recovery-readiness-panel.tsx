"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ArchiveIcon,
  CheckIcon,
  ClockIcon,
  DatabaseIcon,
  RefreshIcon,
  ShieldIcon,
  TrashIcon,
  WarningIcon,
} from "@/components/shared/icons";
import { useDesktopSecurity } from "@/components/providers/desktop-security-provider";
import { createRecoveryReadinessReport, selectRecoveryDrillCandidate } from "@/lib/recovery-readiness-engine";
import {
  clearRecoveryReadinessHistory,
  loadRecoveryReadinessPreferences,
  loadRecoveryReadinessRuntimeState,
  saveRecoveryReadinessPreferences,
} from "@/lib/recovery-readiness-preferences";
import { executeRecoveryReadinessDrill } from "@/lib/recovery-readiness-runtime";
import { listNativeBackups } from "@/lib/desktop/protection";
import { formatFileSize, formatSettingsDateTime } from "@/lib/settings";
import type { NativeBackupRecord } from "@/types/desktop-protection";
import type { RecoveryReadinessPreferences, RecoveryReadinessRuntimeState } from "@/types/recovery-readiness";

export function RecoveryReadinessPanel({ onFeedback }: { onFeedback: (message: string) => void }) {
  const { getDeviceBackupKey } = useDesktopSecurity();
  const [preferences, setPreferences] = useState<RecoveryReadinessPreferences>(loadRecoveryReadinessPreferences());
  const [runtime, setRuntime] = useState<RecoveryReadinessRuntimeState>(loadRecoveryReadinessRuntimeState());
  const [backups, setBackups] = useState<NativeBackupRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setBackups(await listNativeBackups());
      setPreferences(loadRecoveryReadinessPreferences());
      setRuntime(loadRecoveryReadinessRuntimeState());
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const update = () => void refresh();
    window.addEventListener("finnacialux-recovery-readiness-updated", update);
    return () => window.removeEventListener("finnacialux-recovery-readiness-updated", update);
  }, [refresh]);

  function persist(next: RecoveryReadinessPreferences) {
    setPreferences(saveRecoveryReadinessPreferences(next));
    onFeedback("Preferências do teste de recuperação salvas neste computador.");
  }

  async function runDrill() {
    setBusy(true);
    setError("");
    try {
      const state = await executeRecoveryReadinessDrill(getDeviceBackupKey, { force: true });
      setRuntime(state);
      onFeedback(state.lastReason ?? "Ensaio de recuperação concluído.");
      await refresh();
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : String(caught);
      setError(message);
      setRuntime(loadRecoveryReadinessRuntimeState());
    } finally {
      setBusy(false);
    }
  }

  function clearHistory() {
    setRuntime(clearRecoveryReadinessHistory());
    onFeedback("Histórico local de ensaios removido.");
  }

  const report = createRecoveryReadinessReport({ backups, preferences, runtime });
  const candidate = selectRecoveryDrillCandidate(backups);

  return (
    <section className="settings-section recovery-readiness-panel">
      <div className="settings-section-heading">
        <div>
          <span className="section-eyebrow">Recuperação comprovada</span>
          <h2>Teste de recuperação e plano de desastre</h2>
          <p>Abre, descriptografa e valida a cópia mais recente em modo de ensaio. O banco financeiro atual nunca é substituído durante o teste.</p>
        </div>
        <button className="primary-action-button" type="button" disabled={busy || loading} onClick={() => void runDrill()}>
          <RefreshIcon /> {busy ? "Testando..." : "Executar ensaio agora"}
        </button>
      </div>

      <div className={`recovery-readiness-score ${report.status}`}>
        <div className="recovery-readiness-score-value">{report.score}</div>
        <div><strong>{report.ready ? "Recuperação pronta" : report.status === "blocked" ? "Recuperação bloqueada" : "Recuperação requer atenção"}</strong><p>RPO {report.rpoHours === null ? "não medido" : `até ${report.rpoHours}h`} · RTO {report.rtoMinutes === null ? "não medido" : `observado em ${report.rtoMinutes} min`}</p></div>
        {report.ready ? <ShieldIcon /> : <WarningIcon />}
      </div>

      <div className="recovery-readiness-metrics">
        <article><ArchiveIcon /><span><small>Cópia ensaiada</small><strong>{candidate?.fileName ?? "Nenhuma cópia"}</strong><p>{candidate ? `${formatFileSize(candidate.sizeBytes)} · ${formatSettingsDateTime(candidate.createdAt)}` : "Crie um backup automático criptografado."}</p></span></article>
        <article><ClockIcon /><span><small>Próximo ensaio</small><strong>{report.nextDrillAt ? formatSettingsDateTime(report.nextDrillAt) : "Automação desativada"}</strong><p>O ensaio só roda quando o intervalo estiver vencido.</p></span></article>
        <article><DatabaseIcon /><span><small>Schema recuperável</small><strong>{candidate ? `Schema ${candidate.schemaVersion}` : "Indisponível"}</strong><p>O schema SQLCipher 14 permanece congelado.</p></span></article>
        <article><CheckIcon /><span><small>Último resultado</small><strong>{runtime.lastStatus === "passed" ? "Aprovado" : runtime.lastStatus === "failed" ? "Falhou" : "Ainda não testado"}</strong><p>{runtime.lastReason ?? "Execute o primeiro ensaio para medir a recuperação."}</p></span></article>
      </div>

      <div className="recovery-readiness-checks">
        {report.checks.map((item) => (
          <article className={item.status} key={item.id}>
            <span>{item.status === "passed" ? <CheckIcon /> : item.status === "attention" ? <ClockIcon /> : <WarningIcon />}</span>
            <div><strong>{item.title}</strong><p>{item.detail}</p></div>
          </article>
        ))}
      </div>

      <div className="maintenance-preferences-grid">
        <article className="updates-preferences-card">
          <div><span className="section-eyebrow">Periodicidade</span><h3>Ensaio automático</h3></div>
          <label className="settings-toggle-row"><span><strong>Ativar testes periódicos</strong><small>Executa somente a pré-visualização criptografada, sem restaurar dados.</small></span><input type="checkbox" checked={preferences.enabled} onChange={(event) => persist({ ...preferences, enabled: event.target.checked })} /></label>
          <label className="settings-toggle-row"><span><strong>Verificar ao iniciar</strong><small>O intervalo impede testes repetidos em cada abertura.</small></span><input type="checkbox" checked={preferences.runOnStartup} onChange={(event) => persist({ ...preferences, runOnStartup: event.target.checked })} /></label>
          <label className="settings-toggle-row"><span><strong>Verificar ao retornar</strong><small>Reavalia quando a janela recebe foco e o ciclo estiver vencido.</small></span><input type="checkbox" checked={preferences.runOnFocus} onChange={(event) => persist({ ...preferences, runOnFocus: event.target.checked })} /></label>
          <label className="form-field settings-field"><span>Intervalo entre ensaios</span><select value={preferences.intervalDays} onChange={(event) => persist({ ...preferences, intervalDays: Number(event.target.value) as RecoveryReadinessPreferences["intervalDays"] })}><option value={7}>7 dias</option><option value={14}>14 dias</option><option value={30}>30 dias</option></select></label>
        </article>

        <article className="updates-preferences-card">
          <div><span className="section-eyebrow">Objetivos de recuperação</span><h3>RPO, redundância e avisos</h3></div>
          <label className="form-field settings-field"><span>Idade máxima da cópia</span><select value={preferences.maximumBackupAgeDays} onChange={(event) => persist({ ...preferences, maximumBackupAgeDays: Number(event.target.value) as RecoveryReadinessPreferences["maximumBackupAgeDays"] })}><option value={1}>1 dia</option><option value={3}>3 dias</option><option value={7}>7 dias</option><option value={14}>14 dias</option></select></label>
          <label className="settings-toggle-row"><span><strong>Exigir duas cópias</strong><small>Evita considerar uma única cópia como plano completo.</small></span><input type="checkbox" checked={preferences.requireTwoBackups} onChange={(event) => persist({ ...preferences, requireTwoBackups: event.target.checked })} /></label>
          <label className="settings-toggle-row"><span><strong>Avisar quando aprovar</strong><small>Mostra confirmação local após um ensaio completo.</small></span><input type="checkbox" checked={preferences.notifyOnSuccess} onChange={(event) => persist({ ...preferences, notifyOnSuccess: event.target.checked })} /></label>
          <label className="settings-toggle-row"><span><strong>Avisar em falhas</strong><small>Informa incompatibilidade, corrupção ou chave indisponível.</small></span><input type="checkbox" checked={preferences.notifyOnFailure} onChange={(event) => persist({ ...preferences, notifyOnFailure: event.target.checked })} /></label>
          <label className="form-field settings-field"><span>Histórico local</span><select value={preferences.historyRetention} onChange={(event) => persist({ ...preferences, historyRetention: Number(event.target.value) as RecoveryReadinessPreferences["historyRetention"] })}><option value={10}>10 ensaios</option><option value={20}>20 ensaios</option><option value={50}>50 ensaios</option></select></label>
        </article>
      </div>

      <div className="recovery-disaster-plan">
        <div className="settings-panel-header compact"><div><h3>Plano de desastre local</h3><p>Ordem recomendada para uma recuperação real, sempre com cópia de segurança anterior.</p></div></div>
        <ol>{report.plan.map((step) => <li key={step}>{step}</li>)}</ol>
      </div>

      <div className="backup-automation-actions">
        <button className="secondary-action-button" type="button" onClick={() => void refresh()}><RefreshIcon /> Atualizar estado</button>
        <button className="text-action-button" type="button" onClick={() => { window.location.hash = "backups"; }}><ArchiveIcon /> Abrir backups e restauração</button>
        <button className="text-action-button" type="button" onClick={clearHistory}><TrashIcon /> Limpar histórico</button>
      </div>

      <div className="backup-automation-history">
        <div className="settings-panel-header compact"><div><h3>Ensaios recentes</h3><p>Histórico técnico local sem saldos, lançamentos ou conteúdo do backup.</p></div></div>
        {runtime.history.length === 0 ? (
          <div className="settings-empty-state"><ShieldIcon /><strong>Nenhum ensaio registrado</strong><span>Execute o primeiro teste para comprovar a recuperabilidade.</span></div>
        ) : runtime.history.map((entry) => (
          <article key={entry.id} className={entry.status === "passed" ? "created" : "failed"}>
            <span>{entry.status === "passed" ? <CheckIcon /> : <WarningIcon />}</span>
            <div><strong>{entry.status === "passed" ? "Recuperação aprovada" : "Ensaio falhou"}</strong><p>{entry.reason}</p><small>{formatSettingsDateTime(entry.testedAt)} · schema {entry.schemaVersion} · {Math.max(1, Math.ceil(entry.durationMs / 1000))}s</small></div>
          </article>
        ))}
      </div>

      {error ? <div className="continuity-error" role="alert">{error}</div> : null}
    </section>
  );
}
