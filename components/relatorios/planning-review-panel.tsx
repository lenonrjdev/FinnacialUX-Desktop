import type { ChangeEvent } from "react";
import { useState } from "react";
import { CheckIcon } from "@/components/shared/icons";
import { formatCurrency } from "@/lib/formatters";
import type { FinancialPlanSimulation, SavedFinancialPlan } from "@/types/financial-planning";

export function PlanningReviewPanel({ simulation, activePlan, disabled, onRecord }: { simulation: FinancialPlanSimulation; activePlan: SavedFinancialPlan | null; disabled: boolean; onRecord: (notes: string, acceptedAdjustments: string[]) => Promise<void> }) {
  const [notes, setNotes] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const toggle = (id: string) => setSelected((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  return (
    <div className="planning-review-layout">
      <section className="report-panel">
        <header className="report-panel-header"><div><h3>Plano x realizado</h3><p>Registre somente os ajustes aceitos conscientemente.</p></div></header>
        <div className="planning-deviation-list">{simulation.deviations.map((item) => <label className={`planning-deviation-row planning-card-${item.health}`} key={item.id}><input type="checkbox" disabled={disabled || !activePlan} checked={selected.includes(item.id)} onChange={() => toggle(item.id)} /><span><strong>{item.label}</strong><small>{item.explanation}</small></span><dl><div><dt>Plano</dt><dd>{formatCurrency(item.plannedAmount)}</dd></div><div><dt>Real</dt><dd>{formatCurrency(item.actualAmount)}</dd></div><div><dt>Desvio</dt><dd>{item.deviationPercent.toFixed(1)}%</dd></div></dl></label>)}</div>
      </section>
      <section className="report-panel">
        <header className="report-panel-header"><div><h3>Recomendações explicáveis</h3><p>Sugestões locais; nenhuma delas altera seus dados automaticamente.</p></div></header>
        <div className="planning-recommendation-list">{simulation.recommendations.length === 0 ? <p className="planning-empty-state">Nenhum ajuste prioritário foi identificado.</p> : simulation.recommendations.map((item) => <article key={item.id} className={`planning-recommendation planning-priority-${item.priority}`}><span>{item.priority === "high" ? "Alta" : item.priority === "medium" ? "Média" : "Baixa"}</span><div><strong>{item.title}</strong><p>{item.message}</p><small>{item.action}</small></div>{item.impactAmount !== null ? <b>{formatCurrency(item.impactAmount)}</b> : null}</article>)}</div>
        <label className="planning-review-notes"><span>Notas da revisão</span><textarea disabled={disabled || !activePlan} value={notes} maxLength={4000} onChange={(event: ChangeEvent<HTMLTextAreaElement>) => setNotes(event.target.value)} placeholder="Explique mudanças de renda, gastos excepcionais ou decisões tomadas." /></label>
        <button className="primary-action-button" type="button" disabled={disabled || !activePlan} onClick={() => void onRecord(notes, selected).then(() => { setNotes(""); setSelected([]); })}><CheckIcon /> Registrar revisão mensal</button>
        {!activePlan ? <small className="planning-help-text">Ative um plano antes de registrar revisões.</small> : null}
      </section>
    </div>
  );
}
