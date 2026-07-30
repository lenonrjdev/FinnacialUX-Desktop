import { CalendarIcon, CheckIcon, ClockIcon } from "@/components/shared/icons";
import { formatCurrency } from "@/lib/formatters";
import type { PlanningDecision, PlanningDecisionStatus } from "@/types/financial-planning";

export function PlanningDecisionsPanel({ decisions, disabled, onStatus }: { decisions: PlanningDecision[]; disabled: boolean; onStatus: (id: string, status: PlanningDecisionStatus) => Promise<void> }) {
  return (
    <section className="report-panel">
      <header className="report-panel-header"><div><h3>Calendário de decisões</h3><p>Marcos gerados na ativação do plano e decisões adicionadas manualmente.</p></div></header>
      {decisions.length === 0 ? <p className="planning-empty-state">Ative um plano para gerar o calendário de decisões.</p> : <div className="planning-decision-list">{decisions.map((decision) => <article className={`planning-decision planning-decision-${decision.status}`} key={decision.id}><span className="planning-decision-icon">{decision.status === "completed" ? <CheckIcon /> : decision.status === "dismissed" ? <ClockIcon /> : <CalendarIcon />}</span><div><strong>{decision.title}</strong><p>{decision.notes}</p><small>{decision.decisionDate} · {decision.kind}</small></div>{decision.amount !== null ? <b>{formatCurrency(decision.amount)}</b> : null}<div className="planning-decision-actions"><button type="button" disabled={disabled || decision.status === "completed"} onClick={() => void onStatus(decision.id, "completed")}>Concluir</button><button type="button" disabled={disabled || decision.status === "dismissed"} onClick={() => void onStatus(decision.id, "dismissed")}>Dispensar</button></div></article>)}</div>}
    </section>
  );
}
