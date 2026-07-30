"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CheckIcon,
  ClockIcon,
  HistoryIcon,
  MagicWandIcon,
  RefreshIcon,
  TrashIcon,
  WarningIcon,
} from "@/components/shared/icons";
import { automationsContent } from "@/content/automations";
import { canUndoAutomationRun } from "@/lib/automation-engine";
import {
  applyAutomations,
  getAutomationPreferences,
  listAutomationRuns,
  markAutomationAlert,
  saveAutomationPreferences,
  simulateAutomations,
  undoAutomationRun,
} from "@/lib/desktop/automations";
import { formatCurrency, formatShortDate } from "@/lib/formatters";
import { getReferenceDate } from "@/lib/reference-date";
import type {
  AutomationAlert,
  AutomationCandidate,
  AutomationPreferences,
  AutomationPreview,
  AutomationRun,
} from "@/types/desktop-automations";

function currentDate(): string {
  return getReferenceDate();
}

function formatDateTime(value: string | null): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

function candidateValue(candidate: AutomationCandidate): string {
  const amount = Number(candidate.after.amount ?? 0);
  if (candidate.kind === "recurrence") return `${formatCurrency(amount)} · ${candidate.occurrenceDate ? formatShortDate(candidate.occurrenceDate) : ""}`;
  const changes = ["category", "account", "type"]
    .filter((field) => candidate.before?.[field] !== candidate.after[field])
    .map((field) => `${field}: ${String(candidate.after[field] ?? "—")}`);
  return changes.join(" · ");
}

function alertClass(alert: AutomationAlert): string {
  return `automation-alert-card ${alert.severity}`;
}

function candidateKindLabel(candidate: AutomationCandidate): string {
  if (candidate.kind === "recurrence") return automationsContent.candidates.recurrence;
  if (candidate.kind === "suggestion") return automationsContent.candidates.suggestion;
  return automationsContent.candidates.rule;
}

export function AutomationCenterPanel({
  saving,
  readOnly,
  onReloadFinance,
  onFeedback,
}: {
  saving: boolean;
  readOnly: boolean;
  onReloadFinance: () => Promise<void>;
  onFeedback: (message: string) => void;
}) {
  const [preferences, setPreferences] = useState<AutomationPreferences | null>(null);
  const [preview, setPreview] = useState<AutomationPreview | null>(null);
  const [runs, setRuns] = useState<AutomationRun[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);

  const loadRuns = useCallback(async () => {
    setRuns(await listAutomationRuns());
  }, []);

  const simulate = useCallback(async (announce = true) => {
    if (saving) {
      setError(automationsContent.center.saving);
      return;
    }
    setBusy(true);
    setError("");
    try {
      const next = await simulateAutomations(currentDate());
      setPreview(next);
      setSelectedIds(next.candidates.map((candidate) => candidate.id));
      if (announce) onFeedback(automationsContent.feedback.simulated);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Não foi possível simular as automações.");
    } finally {
      setBusy(false);
    }
  }, [onFeedback, saving]);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const [nextPreferences, nextRuns] = await Promise.all([
          getAutomationPreferences(),
          listAutomationRuns(),
        ]);
        if (!active) return;
        setPreferences(nextPreferences);
        setRuns(nextRuns);
        if (nextPreferences.startupScanEnabled && !saving) void simulate(false);
      } catch (caught) {
        if (active) setError(caught instanceof Error ? caught.message : "Não foi possível abrir a central de automações.");
      }
    })();
    return () => { active = false; };
  }, [saving, simulate]);

  async function applySelected() {
    if (!preview || !selectedIds.length || readOnly || saving) return;
    setBusy(true);
    setError("");
    try {
      await applyAutomations({
        sourceChecksum: preview.sourceChecksum,
        referenceDate: preview.referenceDate,
        selectedCandidateIds: selectedIds,
      });
      await onReloadFinance();
      await loadRuns();
      await simulate(false);
      onFeedback(automationsContent.feedback.applied);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Não foi possível aplicar as automações.");
    } finally {
      setBusy(false);
    }
  }

  async function undoRun(run: AutomationRun) {
    if (!canUndoAutomationRun(run) || readOnly || saving) return;
    if (!window.confirm("Desfazer esta execução e restaurar os módulos exatamente como estavam?")) return;
    setBusy(true);
    setError("");
    try {
      await undoAutomationRun(run.id);
      await onReloadFinance();
      await loadRuns();
      await simulate(false);
      onFeedback(automationsContent.feedback.undone);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Não foi possível desfazer a execução.");
    } finally {
      setBusy(false);
    }
  }

  async function updateAlert(alert: AutomationAlert, status: "read" | "dismissed") {
    if (readOnly || saving) return;
    try {
      await markAutomationAlert(alert.id, status);
      await simulate(false);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Não foi possível atualizar o alerta.");
    }
  }

  async function persistPreferences() {
    if (!preferences || readOnly || saving) return;
    setBusy(true);
    setError("");
    try {
      const next = await saveAutomationPreferences(preferences);
      setPreferences(next);
      await simulate(false);
      onFeedback(automationsContent.feedback.preferencesSaved);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Não foi possível salvar a política de automações.");
    } finally {
      setBusy(false);
    }
  }

  const summary = preview?.summary ?? { ruleChanges: 0, learnedSuggestions: 0, recurringTransactions: 0, alerts: 0, totalCandidates: 0 };

  return (
    <section className="automation-center-layout">
      <article className="data-tool-panel automation-center-main">
        <header className="data-tool-panel-header automation-center-header">
          <div>
            <span className="section-eyebrow">{automationsContent.center.eyebrow}</span>
            <h2>{automationsContent.center.title}</h2>
            <p>{automationsContent.center.description}</p>
          </div>
          <div className="automation-center-actions">
            <button className="secondary-action-button" type="button" disabled={busy || saving} onClick={() => void simulate()}>
              <RefreshIcon />{busy ? automationsContent.center.running : automationsContent.center.simulate}
            </button>
            <button className="primary-action-button" type="button" disabled={busy || saving || readOnly || !selectedIds.length} onClick={() => void applySelected()}>
              <CheckIcon />{automationsContent.center.apply}
            </button>
          </div>
        </header>

        {readOnly ? <p className="automation-read-only-note"><WarningIcon />{automationsContent.center.readOnly}</p> : null}
        {error ? <p className="data-tools-error"><WarningIcon />{error}</p> : null}

        <div className="automation-summary-grid" aria-label="Resumo da simulação">
          <div><MagicWandIcon /><span>{automationsContent.summary.rules}</span><strong>{summary.ruleChanges}</strong></div>
          <div><MagicWandIcon /><span>{automationsContent.summary.suggestions}</span><strong>{summary.learnedSuggestions}</strong></div>
          <div><ClockIcon /><span>{automationsContent.summary.recurrences}</span><strong>{summary.recurringTransactions}</strong></div>
          <div><WarningIcon /><span>{automationsContent.summary.alerts}</span><strong>{summary.alerts}</strong></div>
          <div className="featured"><CheckIcon /><span>{automationsContent.summary.selected}</span><strong>{selectedIds.length}</strong></div>
        </div>

        <section className="automation-preview-section">
          <header className="automation-section-header">
            <div><h3>{automationsContent.candidates.title}</h3><p>{automationsContent.candidates.description}</p></div>
            {preview?.candidates.length ? (
              <div>
                <button type="button" onClick={() => setSelectedIds(preview.candidates.map((candidate) => candidate.id))}>{automationsContent.candidates.selectAll}</button>
                <button type="button" onClick={() => setSelectedIds([])}>{automationsContent.candidates.clear}</button>
              </div>
            ) : null}
          </header>
          <div className="automation-candidate-list">
            {!preview ? <p className="data-tools-empty-copy">{automationsContent.center.noPreview}</p> : null}
            {preview && !preview.candidates.length ? <p className="data-tools-empty-copy">{automationsContent.center.noCandidates}</p> : null}
            {preview?.candidates.map((candidate) => (
              <label className={`automation-candidate-card ${selectedSet.has(candidate.id) ? "selected" : ""}`} key={candidate.id}>
                <input
                  type="checkbox"
                  checked={selectedSet.has(candidate.id)}
                  onChange={() => setSelectedIds((current) => current.includes(candidate.id)
                    ? current.filter((id) => id !== candidate.id)
                    : [...current, candidate.id])}
                />
                <span className="automation-candidate-icon">{candidate.kind === "recurrence" ? <ClockIcon /> : <MagicWandIcon />}</span>
                <div>
                  <div><strong>{candidate.title}</strong><span>{candidateKindLabel(candidate)}</span></div>
                  <p>{candidate.description}</p>
                  <small>{candidateValue(candidate)}</small>
                </div>
              </label>
            ))}
          </div>
        </section>
      </article>

      <aside className="automation-center-sidebar">
        <section className="data-tool-panel automation-alerts-panel">
          <header className="data-tool-panel-header compact"><div><h2>{automationsContent.alerts.title}</h2><p>{automationsContent.alerts.description}</p></div></header>
          <div className="automation-alert-list">
            {preview?.alerts.length ? preview.alerts.map((alert) => (
              <article className={alertClass(alert)} key={alert.id}>
                <WarningIcon />
                <div><strong>{alert.title}</strong><p>{alert.message}</p><small>{formatShortDate(alert.dueAt)}</small></div>
                <div>
                  <button type="button" disabled={busy || saving || readOnly} onClick={() => void updateAlert(alert, "read")}>{automationsContent.alerts.markRead}</button>
                  <button type="button" disabled={busy || saving || readOnly} onClick={() => void updateAlert(alert, "dismissed")}><TrashIcon />{automationsContent.alerts.dismiss}</button>
                </div>
              </article>
            )) : <p className="data-tools-empty-copy">{automationsContent.alerts.empty}</p>}
          </div>
        </section>

        <section className="data-tool-panel automation-preferences-panel">
          <header className="data-tool-panel-header compact"><div><h2>{automationsContent.preferences.title}</h2></div></header>
          {preferences ? <div className="automation-preferences-form">
            <label><input type="checkbox" checked={preferences.simulationRequired} disabled /><span>{automationsContent.preferences.simulationRequired}</span></label>
            <label><input type="checkbox" checked={preferences.startupScanEnabled} disabled={readOnly || saving} onChange={(event) => setPreferences({ ...preferences, startupScanEnabled: event.target.checked })} /><span>{automationsContent.preferences.startupScanEnabled}</span></label>
            <label className="automation-days-field"><span>{automationsContent.preferences.dueWindowDays}</span><input type="number" min={1} max={60} value={preferences.dueWindowDays} disabled={readOnly || saving} onChange={(event) => setPreferences({ ...preferences, dueWindowDays: Math.max(1, Math.min(60, Number(event.target.value) || 1)) })} /></label>
            <label><input type="checkbox" checked={preferences.alertOverdue} disabled={readOnly || saving} onChange={(event) => setPreferences({ ...preferences, alertOverdue: event.target.checked })} /><span>{automationsContent.preferences.alertOverdue}</span></label>
            <label><input type="checkbox" checked={preferences.alertUpcoming} disabled={readOnly || saving} onChange={(event) => setPreferences({ ...preferences, alertUpcoming: event.target.checked })} /><span>{automationsContent.preferences.alertUpcoming}</span></label>
            <button className="secondary-action-button" type="button" disabled={busy || saving || readOnly} onClick={() => void persistPreferences()}>{automationsContent.preferences.save}</button>
          </div> : null}
        </section>

        <section className="data-tool-panel automation-history-panel">
          <header className="data-tool-panel-header compact"><div><h2>{automationsContent.history.title}</h2><p>{automationsContent.history.description}</p></div></header>
          <div className="automation-run-list">
            {runs.length ? runs.map((run) => (
              <article key={run.id}>
                <HistoryIcon />
                <div><strong>{run.changesApplied} alterações</strong><span>{formatDateTime(run.completedAt ?? run.createdAt)}</span><small>{run.affectedModules.join(" · ") || "Sem módulos"}</small></div>
                <span className={`automation-run-status ${run.status}`}>{automationsContent.history[run.status]}</span>
                {canUndoAutomationRun(run) ? <button type="button" disabled={busy || saving || readOnly} onClick={() => void undoRun(run)}>{automationsContent.history.undo}</button> : null}
              </article>
            )) : <p className="data-tools-empty-copy">{automationsContent.history.empty}</p>}
          </div>
        </section>
      </aside>
    </section>
  );
}
