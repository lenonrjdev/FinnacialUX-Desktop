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
import {
  createBackupAutomationHealth,
  calculateNextAutomaticBackupAt,
} from "@/lib/backup-automation-engine";
import {
  clearBackupAutomationHistory,
  loadBackupAutomationPreferences,
  loadBackupAutomationRuntimeState,
  saveBackupAutomationPreferences,
} from "@/lib/backup-automation-preferences";
import { executeBackupAutomationCycle } from "@/lib/backup-automation-runtime";
import { getNativeBackupPreferences, listNativeBackups } from "@/lib/desktop/protection";
import { formatFileSize, formatSettingsDateTime } from "@/lib/settings";
import type {
  BackupAutomationPreferences,
  BackupAutomationRuntimeState,
} from "@/types/backup-automation";
import type { BackupSettings } from "@/types/configuracoes";
import type { NativeBackupRecord } from "@/types/desktop-protection";

const frequencyLabels: Record<BackupSettings["frequency"], string> = {
  daily: "Diariamente",
  weekly: "Semanalmente",
  monthly: "Mensalmente",
};

export function BackupAutomationPanel({ onFeedback }: { onFeedback: (message: string) => void }) {
  const { getDeviceBackupKey } = useDesktopSecurity();
  const [preferences, setPreferences] = useState<BackupAutomationPreferences>(loadBackupAutomationPreferences());
  const [runtime, setRuntime] = useState<BackupAutomationRuntimeState>(loadBackupAutomationRuntimeState());
  const [nativePreferences, setNativePreferences] = useState<BackupSettings | null>(null);
  const [latestAutomatic, setLatestAutomatic] = useState<NativeBackupRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [stored, backups] = await Promise.all([
        getNativeBackupPreferences(),
        listNativeBackups(),
      ]);
      setNativePreferences(stored);
      setLatestAutomatic(
        backups
          .filter((item) => item.kind === "automatic" && item.status === "available")
          .sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt))[0] ?? null,
      );
      setRuntime(loadBackupAutomationRuntimeState());
      setPreferences(loadBackupAutomationPreferences());
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const update = () => void refresh();
    window.addEventListener("finnacialux-backup-automation-updated", update);
    return () => window.removeEventListener("finnacialux-backup-automation-updated", update);
  }, [refresh]);

  function persist(next: BackupAutomationPreferences) {
    const stored = saveBackupAutomationPreferences(next);
    setPreferences(stored);
    onFeedback("Preferências do executor de backup automático salvas neste computador.");
  }

  async function runNow() {
    setBusy(true);
    setError("");
    try {
      const state = await executeBackupAutomationCycle(getDeviceBackupKey);
      setRuntime(state);
      onFeedback(state.lastReason ?? "Verificação automática concluída.");
      await refresh();
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : String(caught);
      setError(message);
      setRuntime(loadBackupAutomationRuntimeState());
    } finally {
      setBusy(false);
    }
  }

  function clearHistory() {
    setRuntime(clearBackupAutomationHistory());
    onFeedback("Histórico local de execuções automáticas limpo.");
  }

  if (!nativePreferences) {
    return (
      <section className="settings-section backup-automation-panel">
        <div className="updates-loading"><RefreshIcon /> {loading ? "Carregando proteção automática..." : "Proteção indisponível"}</div>
        {error ? <div className="continuity-error" role="alert">{error}</div> : null}
      </section>
    );
  }

  const lastAutomaticAt = latestAutomatic?.createdAt ?? nativePreferences.lastAutomaticAt ?? runtime.lastCreatedAt;
  const health = createBackupAutomationHealth({
    automaticEnabled: nativePreferences.automaticEnabled,
    frequency: nativePreferences.frequency,
    lastAutomaticAt: lastAutomaticAt ?? null,
    runtime,
  });
  const nextBackupAt = nativePreferences.automaticEnabled
    ? calculateNextAutomaticBackupAt(lastAutomaticAt, nativePreferences.frequency).toISOString()
    : null;

  return (
    <section className="settings-section backup-automation-panel">
      <div className="settings-section-heading">
        <div>
          <span className="section-eyebrow">Continuidade sem intervenção</span>
          <h2>Backup automático real</h2>
          <p>Conecta a política já existente ao ciclo do Desktop. O núcleo decide quando criar, criptografar, verificar e remover cópias antigas.</p>
        </div>
        <button className="secondary-action-button" type="button" disabled={busy || loading} onClick={() => void runNow()}>
          <RefreshIcon /> {busy ? "Verificando..." : "Verificar agora"}
        </button>
      </div>

      <div className={`backup-automation-health ${health.status}`}>
        <div className="backup-automation-score">{health.score}</div>
        <div><strong>{health.title}</strong><p>{health.detail}</p></div>
        {health.status === "protected" ? <ShieldIcon /> : health.status === "attention" ? <ClockIcon /> : <WarningIcon />}
      </div>

      <div className="backup-automation-status-grid">
        <article><ArchiveIcon /><span><small>Política nativa</small><strong>{nativePreferences.automaticEnabled ? "Ativa" : "Desativada"}</strong><p>{frequencyLabels[nativePreferences.frequency]} · retenção de {nativePreferences.retentionCount}</p></span></article>
        <article><CheckIcon /><span><small>Última cópia</small><strong>{lastAutomaticAt ? formatSettingsDateTime(lastAutomaticAt) : "Ainda não criada"}</strong><p>{latestAutomatic ? `${latestAutomatic.fileName} · ${formatFileSize(latestAutomatic.sizeBytes)}` : "O primeiro ciclo criará a cópia protegida."}</p></span></article>
        <article><ClockIcon /><span><small>Próxima periodicidade</small><strong>{nextBackupAt ? formatSettingsDateTime(nextBackupAt) : "Sem agendamento"}</strong><p>O comando nativo impede duplicações antes do prazo.</p></span></article>
        <article><DatabaseIcon /><span><small>Executor local</small><strong>{runtime.running ? "Em execução" : runtime.lastStatus === "failed" ? "Requer atenção" : "Pronto"}</strong><p>{runtime.lastReason ?? "Nenhuma verificação registrada nesta instalação."}</p></span></article>
      </div>

      <div className="backup-automation-preferences-grid">
        <article className="updates-preferences-card">
          <div><span className="section-eyebrow">Ciclo do aplicativo</span><h3>Quando verificar</h3></div>
          <label className="settings-toggle-row"><span><strong>Ao iniciar</strong><small>Confere a política quando o cofre e o banco estiverem prontos.</small></span><input type="checkbox" checked={preferences.runOnStartup} onChange={(event) => persist({ ...preferences, runOnStartup: event.target.checked })} /></label>
          <label className="settings-toggle-row"><span><strong>Ao voltar para o aplicativo</strong><small>Executa uma verificação leve quando a janela recebe foco.</small></span><input type="checkbox" checked={preferences.runOnFocus} onChange={(event) => persist({ ...preferences, runOnFocus: event.target.checked })} /></label>
          <label className="form-field settings-field"><span>Intervalo de verificação</span><select value={preferences.checkIntervalMinutes} onChange={(event) => persist({ ...preferences, checkIntervalMinutes: Number(event.target.value) as BackupAutomationPreferences["checkIntervalMinutes"] })}><option value={30}>30 minutos</option><option value={60}>1 hora</option><option value={180}>3 horas</option><option value={360}>6 horas</option></select></label>
        </article>

        <article className="updates-preferences-card">
          <div><span className="section-eyebrow">Avisos e histórico</span><h3>Como acompanhar</h3></div>
          <label className="settings-toggle-row"><span><strong>Avisar quando criar</strong><small>Mostra uma confirmação local somente quando uma nova cópia é produzida.</small></span><input type="checkbox" checked={preferences.notifyOnSuccess} onChange={(event) => persist({ ...preferences, notifyOnSuccess: event.target.checked })} /></label>
          <label className="settings-toggle-row"><span><strong>Avisar em falhas</strong><small>Informa problemas com cofre, armazenamento ou banco sem enviar telemetria.</small></span><input type="checkbox" checked={preferences.notifyOnFailure} onChange={(event) => persist({ ...preferences, notifyOnFailure: event.target.checked })} /></label>
          <label className="form-field settings-field"><span>Histórico local</span><select value={preferences.historyRetention} onChange={(event) => persist({ ...preferences, historyRetention: Number(event.target.value) as BackupAutomationPreferences["historyRetention"] })}><option value={10}>10 execuções</option><option value={20}>20 execuções</option><option value={50}>50 execuções</option></select></label>
        </article>
      </div>

      <div className="backup-automation-actions">
        <button className="primary-action-button" type="button" onClick={() => { window.location.hash = "backups"; }}><ArchiveIcon /> Abrir política e restauração</button>
        <button className="secondary-action-button" type="button" onClick={() => void refresh()}><RefreshIcon /> Atualizar estado</button>
        <button className="text-action-button" type="button" onClick={clearHistory}><TrashIcon /> Limpar histórico</button>
      </div>

      <div className="backup-automation-history">
        <div className="settings-panel-header compact"><div><h3>Últimas verificações</h3><p>Registro técnico local, sem saldos, lançamentos ou envio externo.</p></div></div>
        {runtime.history.length === 0 ? (
          <div className="settings-empty-state"><ArchiveIcon /><strong>Nenhuma execução registrada</strong><span>O histórico será preenchido após a primeira verificação.</span></div>
        ) : runtime.history.map((entry) => (
          <article key={entry.id} className={entry.status}>
            <span>{entry.status === "created" ? <CheckIcon /> : entry.status === "failed" ? <WarningIcon /> : <ClockIcon />}</span>
            <div><strong>{entry.status === "created" ? "Cópia criada" : entry.status === "failed" ? "Falha" : "Sem nova cópia"}</strong><p>{entry.reason}</p><small>{formatSettingsDateTime(entry.checkedAt)}{entry.fileName ? ` · ${entry.fileName}` : ""}</small></div>
          </article>
        ))}
      </div>

      {error ? <div className="continuity-error" role="alert">{error}</div> : null}
    </section>
  );
}
