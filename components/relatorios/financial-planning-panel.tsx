"use client";

import type { ChangeEvent } from "react";
import { useEffect, useMemo, useState } from "react";
import { useDesktopSecurity } from "@/components/providers/desktop-security-provider";
import { useFinanceDataState, useFinanceDataStatus } from "@/components/providers/finance-data-provider";
import { PlanningAllocationEditor } from "@/components/relatorios/planning-allocation-editor";
import { PlanningDecisionsPanel } from "@/components/relatorios/planning-decisions-panel";
import { PlanningReviewPanel } from "@/components/relatorios/planning-review-panel";
import { PlanningCategoryLimits, PlanningDebtStrategy, PlanningGoals } from "@/components/relatorios/planning-strategy-panels";
import { PlanningSummary } from "@/components/relatorios/planning-summary";
import { ArchiveIcon, CheckIcon, SaveIcon, ShieldIcon } from "@/components/shared/icons";
import { planningContent } from "@/content/planning";
import { initialSubscriptions } from "@/data/assinaturas";
import { initialInstallmentPlans } from "@/data/cartoes";
import { initialPayables } from "@/data/contas-a-pagar";
import { initialAccounts } from "@/data/contas";
import { initialDebts } from "@/data/dividas";
import { transactionsData } from "@/data/lancamentos";
import { initialGoals } from "@/data/metas";
import { initialCategories, initialMonthlyBudgets } from "@/data/orcamentos";
import { initialReceivables } from "@/data/recebimentos";
import {
  activateFinancialPlan,
  archiveFinancialPlan,
  getPlanningPreferences,
  listFinancialPlanReviews,
  listFinancialPlans,
  listPlanningDecisions,
  recordFinancialPlanReview,
  saveFinancialPlan,
  savePlanningPreferences,
  updatePlanningDecisionStatus,
} from "@/lib/desktop/planning";
import { hasTauriRuntime } from "@/lib/desktop/runtime";
import { buildFinancialIntelligenceProjection } from "@/lib/intelligence-engine";
import { buildFinancialPlanSimulation } from "@/lib/planning-engine";
import { getReferenceDate } from "@/lib/reference-date";
import { defaultIntelligenceAssumptions, type FinancialIntelligenceProjection } from "@/types/financial-intelligence";
import {
  defaultPlanningDraft,
  type FinancialPlanDraft,
  type FinancialPlanReview,
  type PlanningDecision,
  type PlanningDecisionStatus,
  type PlanningPreferences,
  type SavedFinancialPlan,
} from "@/types/financial-planning";

type PlanningTab = keyof typeof planningContent.tabs;

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Não foi possível concluir a ação local.";
}

const defaultPreferences: Omit<PlanningPreferences, "workspaceId" | "updatedAt"> = {
  defaultPeriod: "monthly",
  defaultDebtStrategy: "avalanche",
  defaultReserveTargetMonths: 6,
  monthlyReviewDay: 25,
  requireSimulationBeforeActivation: true,
};

export function FinancialPlanningPanel({ projection }: { projection: FinancialIntelligenceProjection | null }) {
  const { confirmSensitiveAction } = useDesktopSecurity();
  const { readOnly, saving: financeSaving } = useFinanceDataStatus();
  const [transactions] = useFinanceDataState("transactions", transactionsData);
  const [accounts] = useFinanceDataState("accounts", initialAccounts);
  const [payables] = useFinanceDataState("payables", initialPayables);
  const [receivables] = useFinanceDataState("receivables", initialReceivables);
  const [subscriptions] = useFinanceDataState("subscriptions", initialSubscriptions);
  const [debts] = useFinanceDataState("debts", initialDebts);
  const [installmentPlans] = useFinanceDataState("installment-plans", initialInstallmentPlans);
  const [goals] = useFinanceDataState("goals", initialGoals);
  const [categories] = useFinanceDataState("categories", initialCategories);
  const [monthlyBudgets] = useFinanceDataState("monthly-budgets", initialMonthlyBudgets);
  const [draft, setDraft] = useState<FinancialPlanDraft>({ ...defaultPlanningDraft, allocationPercentages: { ...defaultPlanningDraft.allocationPercentages } });
  const [tab, setTab] = useState<PlanningTab>("design");
  const [plans, setPlans] = useState<SavedFinancialPlan[]>([]);
  const [reviews, setReviews] = useState<FinancialPlanReview[]>([]);
  const [decisions, setDecisions] = useState<PlanningDecision[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [preferences, setPreferences] = useState(defaultPreferences);
  const [desktopRuntime, setDesktopRuntime] = useState(false);
  const [actionPending, setActionPending] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [error, setError] = useState("");
  const referenceDate = getReferenceDate();

  useEffect(() => setDesktopRuntime(hasTauriRuntime()), []);

  useEffect(() => {
    if (!desktopRuntime) return;
    let active = true;
    Promise.all([getPlanningPreferences(), listFinancialPlans(), listFinancialPlanReviews(undefined, 24), listPlanningDecisions(undefined, 100)])
      .then(([storedPreferences, storedPlans, storedReviews, storedDecisions]) => {
        if (!active) return;
        setPreferences({
          defaultPeriod: storedPreferences.defaultPeriod,
          defaultDebtStrategy: storedPreferences.defaultDebtStrategy,
          defaultReserveTargetMonths: storedPreferences.defaultReserveTargetMonths,
          monthlyReviewDay: storedPreferences.monthlyReviewDay,
          requireSimulationBeforeActivation: storedPreferences.requireSimulationBeforeActivation,
        });
        setDraft((current) => ({
          ...current,
          period: storedPreferences.defaultPeriod,
          debtStrategy: storedPreferences.defaultDebtStrategy,
          reserveTargetMonths: storedPreferences.defaultReserveTargetMonths,
        }));
        setPlans(storedPlans);
        setReviews(storedReviews);
        setDecisions(storedDecisions);
        const activePlan = storedPlans.find((item) => item.status === "active");
        if (activePlan) {
          setSelectedPlanId(activePlan.id);
          setDraft(activePlan.draft);
        }
      })
      .catch((caught) => active && setError(errorMessage(caught)));
    return () => { active = false; };
  }, [desktopRuntime]);

  const sourceProjection = useMemo(() => projection ?? buildFinancialIntelligenceProjection({
    referenceDate,
    horizonDays: 365,
    scenario: "expected",
    assumptions: defaultIntelligenceAssumptions,
    anomalySensitivity: "balanced",
    negativeBalanceThreshold: 0,
    includeGoalContributions: true,
    accounts,
    transactions,
    payables,
    receivables,
    subscriptions,
    debts,
    installmentPlans,
    goals,
  }), [accounts, debts, goals, installmentPlans, payables, projection, receivables, referenceDate, subscriptions, transactions]);

  const simulation = useMemo(() => buildFinancialPlanSimulation({
    referenceDate,
    projection: sourceProjection,
    draft,
    monthlyReviewDay: preferences.monthlyReviewDay,
    accounts,
    transactions,
    categories,
    monthlyBudgets,
    debts,
    goals,
  }), [accounts, categories, debts, draft, goals, monthlyBudgets, preferences.monthlyReviewDay, referenceDate, sourceProjection, transactions]);

  const selectedPlan = plans.find((item) => item.id === selectedPlanId) ?? null;
  const activePlan = plans.find((item) => item.status === "active") ?? null;
  const blocked = readOnly || financeSaving || actionPending;

  function showFeedback(message: string) {
    setFeedback(message);
    window.setTimeout(() => setFeedback(""), 3000);
  }

  async function runAction(action: () => Promise<void>) {
    setActionPending(true);
    setError("");
    try { await action(); } catch (caught) { setError(errorMessage(caught)); } finally { setActionPending(false); }
  }

  function loadPlan(plan: SavedFinancialPlan) {
    setSelectedPlanId(plan.id);
    setDraft(plan.draft);
    setTab("design");
    showFeedback(`Plano “${plan.name}” carregado.`);
  }

  async function handleSaveDraft(): Promise<SavedFinancialPlan | null> {
    let saved: SavedFinancialPlan | null = null;
    await runAction(async () => {
      saved = await saveFinancialPlan({ id: selectedPlanId ?? undefined, draft: simulation.draft, simulation });
      setSelectedPlanId(saved.id);
      setPlans((current) => [saved!, ...current.filter((item) => item.id !== saved!.id)]);
      showFeedback(planningContent.feedback.draftSaved);
    });
    return saved;
  }

  async function handleActivate() {
    if (!simulation.canActivate) {
      setError("A simulação possui bloqueios. Revise a estrutura antes de ativar o plano.");
      return;
    }
    if (!(await confirmSensitiveAction("security"))) return;
    await runAction(async () => {
      const saved = await saveFinancialPlan({ id: selectedPlanId ?? undefined, draft: simulation.draft, simulation });
      const activated = await activateFinancialPlan({
        planId: saved.id,
        sourceChecksum: simulation.sourceChecksum,
        projectionChecksum: simulation.projectionChecksum,
        decisions: simulation.decisions,
      });
      setSelectedPlanId(activated.id);
      setPlans((current) => [activated, ...current.filter((item) => item.id !== activated.id).map((item) => item.status === "active" ? { ...item, status: "draft" as const, activatedAt: null } : item)]);
      setDecisions(await listPlanningDecisions(undefined, 100));
      showFeedback(planningContent.feedback.activated);
    });
  }

  async function handleArchive(planId: string) {
    await runAction(async () => {
      await archiveFinancialPlan(planId);
      setPlans((current) => current.map((item) => item.id === planId ? { ...item, status: "archived" as const, activatedAt: null, archivedAt: new Date().toISOString() } : item));
      if (selectedPlanId === planId) setSelectedPlanId(null);
      showFeedback(planningContent.feedback.archived);
    });
  }

  async function handleSavePreferences() {
    await runAction(async () => {
      await savePlanningPreferences(preferences);
      showFeedback(planningContent.feedback.preferencesSaved);
    });
  }

  async function handleReview(notes: string, acceptedAdjustments: string[]) {
    if (!activePlan) return;
    await runAction(async () => {
      const review = await recordFinancialPlanReview({
        planId: activePlan.id,
        reviewMonth: draft.startMonth,
        sourceChecksum: simulation.sourceChecksum,
        summary: simulation.summary,
        deviations: simulation.deviations,
        acceptedAdjustments,
        notes,
      });
      setReviews((current) => [review, ...current.filter((item) => item.id !== review.id)]);
      showFeedback(planningContent.feedback.reviewSaved);
    });
  }

  async function handleDecisionStatus(id: string, status: PlanningDecisionStatus) {
    await runAction(async () => {
      const updated = await updatePlanningDecisionStatus(id, status);
      setDecisions((current) => current.map((item) => item.id === updated.id ? updated : item));
    });
  }

  return (
    <div className="financial-planning-layout">
      <section className="planning-local-banner">
        <span><ShieldIcon /></span>
        <div><strong>{planningContent.badge}</strong><p>{planningContent.description}</p></div>
        <code>{simulation.sourceChecksum}</code>
      </section>

      <section className="planning-action-bar">
        <div className="planning-plan-selector">
          <label><span>Planos salvos</span><select value={selectedPlanId ?? ""} onChange={(event: ChangeEvent<HTMLSelectElement>) => { const plan = plans.find((item) => item.id === event.target.value); if (plan) loadPlan(plan); else setSelectedPlanId(null); }}><option value="">Novo plano</option>{plans.map((item) => <option value={item.id} key={item.id}>{item.name} · {item.status === "active" ? "Ativo" : item.status === "archived" ? "Arquivado" : "Rascunho"}</option>)}</select></label>
          {selectedPlan ? <span className={`planning-status planning-status-${selectedPlan.status === "active" ? "healthy" : selectedPlan.status === "archived" ? "critical" : "attention"}`}>{selectedPlan.status === "active" ? "Plano ativo" : selectedPlan.status === "archived" ? "Arquivado" : "Rascunho"}</span> : null}
        </div>
        <div className="planning-main-actions">
          <button className="secondary-action-button" type="button" disabled={!desktopRuntime || blocked} onClick={() => void handleSavePreferences()}><SaveIcon /> Preferências</button>
          <button className="secondary-action-button" type="button" disabled={!desktopRuntime || blocked} onClick={() => void handleSaveDraft()}><SaveIcon /> {planningContent.actions.saveDraft}</button>
          {selectedPlan && selectedPlan.status !== "archived" ? <button className="secondary-action-button" type="button" disabled={!desktopRuntime || blocked} onClick={() => void handleArchive(selectedPlan.id)}><ArchiveIcon /> {planningContent.actions.archive}</button> : null}
          <button className="primary-action-button" type="button" disabled={!desktopRuntime || blocked || !simulation.canActivate} onClick={() => void handleActivate()}><CheckIcon /> {planningContent.actions.activate}</button>
        </div>
      </section>

      {error ? <div className="planning-message planning-error" role="alert">{error}</div> : null}
      {feedback ? <div className="planning-message planning-success">{feedback}</div> : null}
      {readOnly ? <div className="planning-message planning-error">Modo somente leitura ativo: simule e consulte o plano, mas não salve ou ative alterações.</div> : null}
      {simulation.warnings.map((warning) => <div className="planning-message planning-warning" key={warning}>{warning}</div>)}

      <PlanningSummary simulation={simulation} />

      <nav className="planning-tabs" role="tablist" aria-label="Áreas do planejamento financeiro">
        {(Object.keys(planningContent.tabs) as PlanningTab[]).map((key) => <button type="button" role="tab" aria-selected={tab === key} className={tab === key ? "active" : ""} key={key} onClick={() => setTab(key)}>{planningContent.tabs[key]}</button>)}
      </nav>

      {tab === "design" ? <PlanningAllocationEditor draft={simulation.draft} simulation={simulation} disabled={blocked} onChange={setDraft} /> : null}
      {tab === "categories" ? <PlanningCategoryLimits simulation={simulation} draft={simulation.draft} disabled={blocked} onChange={setDraft} /> : null}
      {tab === "debts" ? <PlanningDebtStrategy simulation={simulation} draft={simulation.draft} disabled={blocked} onChange={setDraft} /> : null}
      {tab === "goals" ? <PlanningGoals simulation={simulation} /> : null}
      {tab === "review" ? <PlanningReviewPanel simulation={simulation} activePlan={activePlan} disabled={blocked} onRecord={handleReview} /> : null}
      {tab === "decisions" ? <PlanningDecisionsPanel decisions={decisions} disabled={blocked} onStatus={handleDecisionStatus} /> : null}

      <section className="planning-preferences-strip">
        <label><span>Estratégia padrão</span><select disabled={blocked} value={preferences.defaultDebtStrategy} onChange={(event: ChangeEvent<HTMLSelectElement>) => setPreferences((current) => ({ ...current, defaultDebtStrategy: event.target.value as PlanningPreferences["defaultDebtStrategy"] }))}><option value="avalanche">Maior juros</option><option value="snowball">Menor saldo</option><option value="priority">Prioridade</option></select></label>
        <label><span>Dia da revisão</span><input disabled={blocked} type="number" min={1} max={28} value={preferences.monthlyReviewDay} onChange={(event: ChangeEvent<HTMLInputElement>) => setPreferences((current) => ({ ...current, monthlyReviewDay: Number(event.target.value) }))} /></label>
        <label><span>Meta de reserva</span><input disabled={blocked} type="number" min={1} max={24} step="0.5" value={preferences.defaultReserveTargetMonths} onChange={(event: ChangeEvent<HTMLInputElement>) => setPreferences((current) => ({ ...current, defaultReserveTargetMonths: Number(event.target.value) }))} /></label>
        <span>{reviews.length} revisão(ões) registrada(s)</span>
      </section>
    </div>
  );
}
