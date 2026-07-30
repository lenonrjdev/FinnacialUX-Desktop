"use client";

import { useEffect, useMemo, useState } from "react";
import { useFinanceDataState, useFinanceDataStatus } from "@/components/providers/finance-data-provider";
import { IntelligenceSummary } from "@/components/relatorios/intelligence-summary";
import { IntelligenceRiskPanel } from "@/components/relatorios/intelligence-risk-panel";
import { IntelligenceSimulator } from "@/components/relatorios/intelligence-simulator";
import {
  ActualVsExpectedPanel,
  IntelligenceAnomaliesPanel,
  IntelligenceEventsTable,
  IntelligenceGoalsPanel,
  IntelligenceTrajectory,
} from "@/components/relatorios/intelligence-projection-panel";
import { CheckIcon, DatabaseIcon, InfoIcon, SaveIcon, ShieldIcon, TrashIcon } from "@/components/shared/icons";
import { intelligenceContent } from "@/content/intelligence";
import { initialSubscriptions } from "@/data/assinaturas";
import { initialInstallmentPlans } from "@/data/cartoes";
import { initialPayables } from "@/data/contas-a-pagar";
import { initialAccounts } from "@/data/contas";
import { initialDebts } from "@/data/dividas";
import { transactionsData } from "@/data/lancamentos";
import { initialGoals } from "@/data/metas";
import { initialReceivables } from "@/data/recebimentos";
import {
  deleteIntelligenceScenario,
  getIntelligencePreferences,
  listIntelligenceScenarios,
  listIntelligenceSnapshots,
  recordIntelligenceSnapshot,
  saveIntelligencePreferences,
  saveIntelligenceScenario,
} from "@/lib/desktop/intelligence";
import { hasTauriRuntime } from "@/lib/desktop/runtime";
import { buildFinancialIntelligenceProjection } from "@/lib/intelligence-engine";
import { getReferenceDate } from "@/lib/reference-date";
import type {
  AnomalySensitivity,
  IntelligenceScenario,
  IntelligenceScenarioAssumptions,
  IntelligenceSnapshotSummary,
  ProjectionHorizonDays,
  SavedIntelligenceScenario,
} from "@/types/financial-intelligence";
import { defaultIntelligenceAssumptions } from "@/types/financial-intelligence";

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Não foi possível concluir a ação local.";
}

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export function FinancialIntelligencePanel({
  scenario,
  onScenarioChange,
  onProjectionChange,
}: {
  scenario: IntelligenceScenario;
  onScenarioChange: (scenario: IntelligenceScenario) => void;
  onProjectionChange?: (projection: ReturnType<typeof buildFinancialIntelligenceProjection>) => void;
}) {
  const { readOnly, saving: financeSaving } = useFinanceDataStatus();
  const [transactions] = useFinanceDataState("transactions", transactionsData);
  const [accounts] = useFinanceDataState("accounts", initialAccounts);
  const [payables] = useFinanceDataState("payables", initialPayables);
  const [receivables] = useFinanceDataState("receivables", initialReceivables);
  const [subscriptions] = useFinanceDataState("subscriptions", initialSubscriptions);
  const [debts] = useFinanceDataState("debts", initialDebts);
  const [installmentPlans] = useFinanceDataState("installment-plans", initialInstallmentPlans);
  const [goals] = useFinanceDataState("goals", initialGoals);
  const [horizonDays, setHorizonDays] = useState<ProjectionHorizonDays>(90);
  const [sensitivity, setSensitivity] = useState<AnomalySensitivity>("balanced");
  const [negativeBalanceThreshold, setNegativeBalanceThreshold] = useState(0);
  const [includeGoalContributions, setIncludeGoalContributions] = useState(true);
  const [assumptions, setAssumptions] = useState<IntelligenceScenarioAssumptions>({ ...defaultIntelligenceAssumptions });
  const [savedScenarios, setSavedScenarios] = useState<SavedIntelligenceScenario[]>([]);
  const [snapshots, setSnapshots] = useState<IntelligenceSnapshotSummary[]>([]);
  const [scenarioName, setScenarioName] = useState("");
  const [loadingPersistence, setLoadingPersistence] = useState(false);
  const [actionPending, setActionPending] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [error, setError] = useState("");
  const [desktopRuntime, setDesktopRuntime] = useState(false);
  const referenceDate = getReferenceDate();

  useEffect(() => {
    setDesktopRuntime(hasTauriRuntime());
  }, []);

  useEffect(() => {
    if (!desktopRuntime) return;
    let active = true;
    setLoadingPersistence(true);
    Promise.all([
      getIntelligencePreferences(),
      listIntelligenceScenarios(),
      listIntelligenceSnapshots(),
    ])
      .then(([preferences, scenarios, storedSnapshots]) => {
        if (!active) return;
        setHorizonDays(preferences.defaultHorizonDays);
        onScenarioChange(preferences.defaultScenario);
        setSensitivity(preferences.anomalySensitivity);
        setNegativeBalanceThreshold(preferences.negativeBalanceThreshold);
        setIncludeGoalContributions(preferences.includeGoalContributions);
        setSavedScenarios(scenarios);
        setSnapshots(storedSnapshots);
      })
      .catch((caught) => {
        if (active) setError(errorMessage(caught));
      })
      .finally(() => {
        if (active) setLoadingPersistence(false);
      });
    return () => {
      active = false;
    };
  }, [desktopRuntime, onScenarioChange]);

  const projection = useMemo(() => buildFinancialIntelligenceProjection({
    referenceDate,
    horizonDays,
    scenario,
    assumptions,
    anomalySensitivity: sensitivity,
    negativeBalanceThreshold,
    includeGoalContributions,
    accounts,
    transactions,
    payables,
    receivables,
    subscriptions,
    debts,
    installmentPlans,
    goals,
  }), [
    accounts,
    assumptions,
    debts,
    goals,
    horizonDays,
    includeGoalContributions,
    installmentPlans,
    negativeBalanceThreshold,
    payables,
    receivables,
    referenceDate,
    scenario,
    sensitivity,
    subscriptions,
    transactions,
  ]);

  useEffect(() => {
    onProjectionChange?.(projection);
  }, [onProjectionChange, projection]);

  const blocked = readOnly || financeSaving || actionPending;

  function showFeedback(message: string) {
    setFeedback(message);
    window.setTimeout(() => setFeedback(""), 2800);
  }

  async function runAction(action: () => Promise<void>) {
    setActionPending(true);
    setError("");
    try {
      await action();
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setActionPending(false);
    }
  }

  async function handleSavePreferences() {
    await runAction(async () => {
      await saveIntelligencePreferences({
        defaultHorizonDays: horizonDays,
        defaultScenario: scenario,
        anomalySensitivity: sensitivity,
        negativeBalanceThreshold,
        includeGoalContributions,
      });
      showFeedback(intelligenceContent.feedback.preferencesSaved);
    });
  }

  async function handleSaveScenario() {
    const name = scenarioName.trim();
    if (name.length < 2) {
      setError("Informe um nome com pelo menos dois caracteres para salvar o cenário.");
      return;
    }
    await runAction(async () => {
      const saved = await saveIntelligenceScenario({
        name,
        scenarioType: scenario,
        horizonDays,
        assumptions,
      });
      setSavedScenarios((current) => [saved, ...current.filter((item) => item.id !== saved.id)]);
      setScenarioName("");
      showFeedback(intelligenceContent.feedback.scenarioSaved);
    });
  }

  async function handleDeleteScenario(id: string) {
    await runAction(async () => {
      await deleteIntelligenceScenario(id);
      setSavedScenarios((current) => current.filter((item) => item.id !== id));
      showFeedback(intelligenceContent.feedback.scenarioDeleted);
    });
  }

  function applySavedScenario(saved: SavedIntelligenceScenario) {
    onScenarioChange(saved.scenarioType);
    setHorizonDays(saved.horizonDays);
    setAssumptions(saved.assumptions);
    showFeedback(`Cenário “${saved.name}” carregado para simulação.`);
  }

  async function handleSnapshot() {
    await runAction(async () => {
      const snapshot = await recordIntelligenceSnapshot({
        referenceDate: projection.referenceDate,
        horizonDays: projection.horizonDays,
        scenarioType: projection.scenario,
        sourceChecksum: projection.sourceChecksum,
        summary: projection.summary,
      });
      setSnapshots((current) => [snapshot, ...current.filter((item) => item.id !== snapshot.id)].slice(0, 12));
      showFeedback(intelligenceContent.feedback.snapshotSaved);
    });
  }

  return (
    <div className="financial-intelligence-layout">
      <section className="intelligence-local-banner">
        <span><ShieldIcon /></span>
        <div>
          <strong>{intelligenceContent.localBadge}</strong>
          <p>{intelligenceContent.description}</p>
        </div>
        <code>{projection.sourceChecksum}</code>
      </section>

      <article className="report-panel intelligence-controls-panel">
        <header className="report-panel-header intelligence-panel-header-with-action">
          <div>
            <h2>{intelligenceContent.title}</h2>
            <p>{intelligenceContent.scenarios[scenario].helper}</p>
          </div>
          <div className="intelligence-control-actions">
            <button type="button" className="secondary-action-button" disabled={!desktopRuntime || blocked} onClick={() => void handleSavePreferences()}>
              <SaveIcon /> {intelligenceContent.controls.savePreferences}
            </button>
            <button type="button" className="primary-action-button" disabled={!desktopRuntime || blocked} onClick={() => void handleSnapshot()}>
              <DatabaseIcon /> {intelligenceContent.controls.snapshot}
            </button>
          </div>
        </header>

        <div className="intelligence-controls-grid">
          <fieldset>
            <legend>{intelligenceContent.controls.horizon}</legend>
            <div className="intelligence-horizon-options">
              {([30, 60, 90, 365] as ProjectionHorizonDays[]).map((value) => (
                <button type="button" className={horizonDays === value ? "active" : ""} key={value} onClick={() => setHorizonDays(value)}>
                  {intelligenceContent.horizons[value]}
                </button>
              ))}
            </div>
          </fieldset>
          <label>
            <span>{intelligenceContent.controls.sensitivity}</span>
            <select value={sensitivity} onChange={(event) => setSensitivity(event.target.value as AnomalySensitivity)}>
              <option value="low">{intelligenceContent.sensitivity.low}</option>
              <option value="balanced">{intelligenceContent.sensitivity.balanced}</option>
              <option value="high">{intelligenceContent.sensitivity.high}</option>
            </select>
          </label>
          <label>
            <span>{intelligenceContent.controls.threshold}</span>
            <input type="number" step="0.01" value={negativeBalanceThreshold} onChange={(event) => setNegativeBalanceThreshold(Number(event.target.value) || 0)} />
          </label>
          <label className="intelligence-checkbox-field">
            <input type="checkbox" checked={includeGoalContributions} onChange={(event) => setIncludeGoalContributions(event.target.checked)} />
            <span>{intelligenceContent.controls.includeGoals}</span>
          </label>
        </div>
      </article>

      <IntelligenceSummary summary={projection.summary} />

      <div className="intelligence-primary-grid">
        <IntelligenceTrajectory projection={projection} />
        <IntelligenceRiskPanel risks={projection.risks} />
      </div>

      <IntelligenceSimulator assumptions={assumptions} onChange={setAssumptions} />

      <div className="intelligence-secondary-grid">
        <ActualVsExpectedPanel projection={projection} />
        <IntelligenceAnomaliesPanel projection={projection} />
        <IntelligenceGoalsPanel projection={projection} />
      </div>

      <div className="intelligence-storage-grid">
        <article className="report-panel intelligence-saved-panel">
          <header className="report-panel-header">
            <div><h2>{intelligenceContent.panels.saved}</h2><p>Reaplique hipóteses sem alterar os dados financeiros reais.</p></div>
          </header>
          <div className="intelligence-save-scenario-row">
            <input value={scenarioName} maxLength={80} placeholder={intelligenceContent.controls.scenarioName} onChange={(event) => setScenarioName(event.target.value)} />
            <button type="button" className="primary-action-button" disabled={!desktopRuntime || blocked} onClick={() => void handleSaveScenario()}>
              <SaveIcon /> {intelligenceContent.controls.saveScenario}
            </button>
          </div>
          {savedScenarios.length === 0 ? <div className="intelligence-empty-state">{intelligenceContent.empty.saved}</div> : (
            <div className="intelligence-saved-list">
              {savedScenarios.map((saved) => (
                <div key={saved.id}>
                  <button type="button" onClick={() => applySavedScenario(saved)}>
                    <strong>{saved.name}</strong>
                    <span>{intelligenceContent.scenarios[saved.scenarioType].label} · {intelligenceContent.horizons[saved.horizonDays]}</span>
                  </button>
                  <button type="button" className="icon-action-button" aria-label={`Excluir ${saved.name}`} disabled={blocked} onClick={() => void handleDeleteScenario(saved.id)}><TrashIcon /></button>
                </div>
              ))}
            </div>
          )}
        </article>

        <article className="report-panel intelligence-snapshots-panel">
          <header className="report-panel-header">
            <div><h2>{intelligenceContent.panels.snapshots}</h2><p>Histórico resumido para comparar a evolução das previsões.</p></div>
          </header>
          {snapshots.length === 0 ? <div className="intelligence-empty-state">{intelligenceContent.empty.snapshots}</div> : (
            <div className="intelligence-snapshot-list">
              {snapshots.map((snapshot) => (
                <div key={snapshot.id}>
                  <span>{formatDateTime(snapshot.createdAt)}</span>
                  <strong>{intelligenceContent.scenarios[snapshot.scenarioType].label} · {intelligenceContent.horizons[snapshot.horizonDays]}</strong>
                  <small>Saldo final: {snapshot.endingBalance.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</small>
                </div>
              ))}
            </div>
          )}
        </article>
      </div>

      <IntelligenceEventsTable projection={projection} />

      <section className="intelligence-methodology-note">
        <InfoIcon />
        <div>
          {projection.explanation.map((line) => <p key={line}>{line}</p>)}
        </div>
      </section>

      {loadingPersistence ? <div className="database-sync-status" role="status">Carregando cenários locais...</div> : null}
      {feedback ? <div className="transaction-feedback reports-feedback" role="status"><CheckIcon />{feedback}</div> : null}
      {error ? <div className="database-sync-error" role="alert">{error}</div> : null}
    </div>
  );
}
