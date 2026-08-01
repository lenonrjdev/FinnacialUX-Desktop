"use client";

import { getVersion } from "@tauri-apps/api/app";
import { useCallback, useEffect, useState } from "react";
import {
  ArchiveIcon,
  CheckIcon,
  ClockIcon,
  CopyIcon,
  DatabaseIcon,
  RefreshIcon,
  ShieldIcon,
  TrashIcon,
  WarningIcon,
} from "@/components/shared/icons";
import { listDiagnosticRuns } from "@/lib/desktop/diagnostics";
import { getDatabaseEncryptionStatus } from "@/lib/desktop/database";
import { isSafeModeEnabled, listNativeBackups } from "@/lib/desktop/protection";
import { deferDesktopUpdates, getDesktopUpdaterStatus } from "@/lib/desktop/updater";
import { createMaintenanceReport, deferUpdates, formatMaintenanceSummary } from "@/lib/maintenance-engine";
import {
  clearLocalTechnicalErrors,
  listLocalTechnicalErrors,
  loadMaintenancePreferences,
  saveMaintenancePreferences,
} from "@/lib/maintenance-preferences";
import type { MaintenancePreferences, MaintenanceSnapshot } from "@/types/maintenance";

const weekdays = ["Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado"];

function formatDate(value: string | null) {
  if (!value) return "Ainda não registrado";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Data indisponível";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

export function MaintenancePanel({ onFeedback }: { onFeedback: (message: string) => void }) {
  const [preferences, setPreferences] = useState<MaintenancePreferences>(loadMaintenancePreferences());
  const [snapshot, setSnapshot] = useState<MaintenanceSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [version, database, updater, backups, diagnostics] = await Promise.all([
        getVersion(),
        getDatabaseEncryptionStatus(true),
        getDesktopUpdaterStatus(),
        listNativeBackups(),
        listDiagnosticRuns(1).catch(() => []),
      ]);
      const latestBackup = backups
        .filter((item) => item.status === "available" && item.integrityStatus !== "failed")
        .sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt))[0];
      setSnapshot({
        currentVersion: version,
        schemaVersion: database.schemaVersion,
        updaterConfigured: updater.configured,
        backupBeforeInstall: updater.preferences.backupBeforeInstall,
        latestBackupAt: latestBackup?.createdAt ?? null,
        latestDiagnosticAt: diagnostics[0]?.completedAt ?? null,
        unresolvedTechnicalErrors: listLocalTechnicalErrors().length,
        readOnly: isSafeModeEnabled(),
        now: new Date().toISOString(),
      });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
      setSnapshot({
        currentVersion: "1.3.0",
        schemaVersion: 14,
        updaterConfigured: false,
        backupBeforeInstall: true,
        latestBackupAt: null,
        latestDiagnosticAt: null,
        unresolvedTechnicalErrors: listLocalTechnicalErrors().length,
        readOnly: false,
        now: new Date().toISOString(),
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  function persist(next: MaintenancePreferences, message = "Preferências de manutenção salvas neste computador.") {
    setPreferences(saveMaintenancePreferences(next));
    onFeedback(message);
  }

  function postpone(days: 1 | 3 | 7) {
    const next = deferUpdates(preferences, days);
    deferDesktopUpdates(next.deferredUpdatesUntil);
    persist(next, `Atualizações automáticas adiadas por ${days} dia(s).`);
  }

  function registerMaintenance() {
    persist({ ...preferences, lastMaintenanceAt: new Date().toISOString() }, "Ciclo de manutenção registrado.");
    void refresh();
  }

  async function copySummary() {
    if (!snapshot) return;
    try {
      await navigator.clipboard.writeText(formatMaintenanceSummary(createMaintenanceReport(snapshot, preferences)));
      onFeedback("Resumo de manutenção copiado.");
    } catch {
      setError("Não foi possível copiar o resumo de manutenção.");
    }
  }

  function clearJournal() {
    clearLocalTechnicalErrors();
    onFeedback("Diário técnico local limpo.");
    void refresh();
  }

  if (!snapshot) {
    return <section className="settings-section maintenance-panel"><div className="updates-loading"><RefreshIcon /> Preparando manutenção...</div></section>;
  }

  const report = createMaintenanceReport(snapshot, preferences);

  return (
    <section className="settings-section maintenance-panel">
      <div className="settings-section-heading">
        <div>
          <span className="section-eyebrow">Operação pós-lançamento</span>
          <h2>Manutenção segura</h2>
          <p>Organize atualizações, backups, diagnóstico e suporte sem enviar telemetria ou dados financeiros.</p>
        </div>
        <button className="secondary-action-button" type="button" disabled={loading} onClick={() => void refresh()}>
          <RefreshIcon /> {loading ? "Verificando..." : "Atualizar estado"}
        </button>
      </div>

      <div className={`maintenance-score-card ${report.ready ? "ready" : "blocked"}`}>
        <div className="maintenance-score-value">{report.score}</div>
        <div><strong>{report.ready ? "Operação protegida" : "Existem bloqueios"}</strong><p>{report.passed} aprovados · {report.attention} atenções · {report.blocked} bloqueios</p></div>
        <ShieldIcon />
      </div>

      <div className="maintenance-check-grid">
        {report.checks.map((item) => (
          <article className={item.status} key={item.id}>
            <div>{item.status === "passed" ? <CheckIcon /> : item.status === "attention" ? <ClockIcon /> : <WarningIcon />}</div>
            <span><strong>{item.title}</strong><small>{item.detail}</small></span>
          </article>
        ))}
      </div>

      <div className="maintenance-preferences-grid">
        <article className="updates-preferences-card">
          <div><span className="section-eyebrow">Janela controlada</span><h3>Quando realizar manutenção</h3></div>
          <label className="settings-toggle-row"><span><strong>Manutenção periódica</strong><small>Mantém lembretes locais para backup, diagnóstico e atualização.</small></span><input type="checkbox" checked={preferences.automaticMaintenance} onChange={(event) => persist({ ...preferences, automaticMaintenance: event.target.checked })} /></label>
          <label className="form-field settings-field"><span>Dia da semana</span><select value={preferences.maintenanceWeekday} onChange={(event) => persist({ ...preferences, maintenanceWeekday: Number(event.target.value) as MaintenancePreferences["maintenanceWeekday"] })}>{weekdays.map((day, index) => <option value={index} key={day}>{day}</option>)}</select></label>
          <label className="form-field settings-field"><span>Horário inicial</span><select value={preferences.maintenanceStartHour} onChange={(event) => persist({ ...preferences, maintenanceStartHour: Number(event.target.value) })}>{Array.from({ length: 24 }, (_, hour) => <option value={hour} key={hour}>{String(hour).padStart(2, "0")}:00</option>)}</select></label>
          <label className="form-field settings-field"><span>Duração da janela</span><select value={preferences.maintenanceWindowDuration} onChange={(event) => persist({ ...preferences, maintenanceWindowDuration: Number(event.target.value) as MaintenancePreferences["maintenanceWindowDuration"] })}><option value={1}>1 hora</option><option value={2}>2 horas</option><option value={4}>4 horas</option></select></label>
          <label className="settings-toggle-row"><span><strong>Instalar somente na janela</strong><small>Bloqueia a instalação fora do período escolhido, mesmo após o download.</small></span><input type="checkbox" checked={preferences.installOnlyInsideWindow} onChange={(event) => persist({ ...preferences, installOnlyInsideWindow: event.target.checked })} /></label>
          <small className="updates-last-check">Próxima janela: {formatDate(report.nextWindowAt)}</small>
        </article>

        <article className="updates-preferences-card">
          <div><span className="section-eyebrow">Rollback e privacidade</span><h3>Proteções pós-release</h3></div>
          <label className="settings-toggle-row"><span><strong>Exigir backup verificado</strong><small>Considera a manutenção bloqueada quando não existe cópia íntegra recente.</small></span><input type="checkbox" checked={preferences.requireVerifiedBackup} onChange={(event) => persist({ ...preferences, requireVerifiedBackup: event.target.checked })} /></label>
          <label className="settings-toggle-row"><span><strong>Diário técnico local</strong><small>Registra somente mensagens sanitizadas neste computador. Nada é enviado automaticamente.</small></span><input type="checkbox" checked={preferences.localTechnicalJournal} onChange={(event) => persist({ ...preferences, localTechnicalJournal: event.target.checked })} /></label>
          <label className="form-field settings-field"><span>Retenção do diário</span><select value={preferences.journalRetention} onChange={(event) => persist({ ...preferences, journalRetention: Number(event.target.value) as MaintenancePreferences["journalRetention"] })}><option value={5}>5 ocorrências</option><option value={10}>10 ocorrências</option><option value={20}>20 ocorrências</option></select></label>
          <div className="maintenance-inline-actions"><button className="text-action-button" type="button" onClick={() => postpone(1)}>Adiar 1 dia</button><button className="text-action-button" type="button" onClick={() => postpone(3)}>Adiar 3 dias</button><button className="text-action-button" type="button" onClick={() => postpone(7)}>Adiar 7 dias</button></div>
          <small className="updates-last-check">Adiamento: {report.deferred ? `até ${formatDate(preferences.deferredUpdatesUntil)}` : "inativo"}</small>
        </article>
      </div>

      <div className="maintenance-artifacts">
        <div><ArchiveIcon /><span><strong>Último backup íntegro</strong><small>{formatDate(snapshot.latestBackupAt)}</small></span></div>
        <div><DatabaseIcon /><span><strong>Último diagnóstico</strong><small>{formatDate(snapshot.latestDiagnosticAt)}</small></span></div>
        <div><WarningIcon /><span><strong>Diário técnico</strong><small>{snapshot.unresolvedTechnicalErrors} ocorrência(s) local(is)</small></span></div>
      </div>

      <div className="release-candidate-actions">
        <button className="primary-action-button" type="button" onClick={registerMaintenance}><CheckIcon /> Registrar manutenção concluída</button>
        <button className="secondary-action-button" type="button" onClick={() => void copySummary()}><CopyIcon /> Copiar resumo</button>
        <button className="text-action-button" type="button" onClick={clearJournal}><TrashIcon /> Limpar diário</button>
        <button className="text-action-button" type="button" onClick={() => { window.location.hash = "diagnostico"; }}><ShieldIcon /> Abrir diagnóstico</button>
      </div>

      {error ? <div className="updates-dev-notice"><WarningIcon /><div><strong>Prévia limitada</strong><p>{error}</p></div></div> : null}
    </section>
  );
}
