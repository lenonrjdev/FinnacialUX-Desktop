import type { ChangeEvent } from "react";
import { formatCurrency } from "@/lib/formatters";
import type { FinancialPlanDraft, FinancialPlanSimulation } from "@/types/financial-planning";

export function PlanningCategoryLimits({ simulation, draft, disabled, onChange }: { simulation: FinancialPlanSimulation; draft: FinancialPlanDraft; disabled: boolean; onChange: (draft: FinancialPlanDraft) => void }) {
  return (
    <section className="report-panel">
      <header className="report-panel-header planning-panel-header"><div><h3>Limites dinâmicos por categoria</h3><p>Baseados no orçamento atual ou na média real dos últimos três meses.</p></div><label><span>Ajuste geral</span><input disabled={disabled} type="number" min={-50} max={100} step={1} value={draft.categoryLimitAdjustmentPercent} onChange={(event: ChangeEvent<HTMLInputElement>) => onChange({ ...draft, categoryLimitAdjustmentPercent: Number(event.target.value) })} /><small>%</small></label></header>
      <div className="planning-table-wrap"><table className="planning-table"><thead><tr><th>Categoria</th><th>Base</th><th>Limite</th><th>Realizado</th><th>Status</th></tr></thead><tbody>{simulation.categoryLimits.map((row) => <tr key={row.categoryId}><td><strong>{row.categoryName}</strong><small>{row.explanation}</small></td><td>{formatCurrency(row.baselineAmount)}</td><td>{formatCurrency(row.plannedLimit)}</td><td>{formatCurrency(row.plannedLimit + row.deviationAmount)}</td><td><span className={`planning-status planning-status-${row.health}`}>{row.health === "healthy" ? "Saudável" : row.health === "attention" ? "Atenção" : "Excedido"}</span></td></tr>)}</tbody></table></div>
    </section>
  );
}

export function PlanningDebtStrategy({ simulation, draft, disabled, onChange }: { simulation: FinancialPlanSimulation; draft: FinancialPlanDraft; disabled: boolean; onChange: (draft: FinancialPlanDraft) => void }) {
  return (
    <section className="report-panel">
      <header className="report-panel-header planning-panel-header"><div><h3>Plano de redução de dívidas</h3><p>A simulação respeita juros, parcela mínima e o envelope mensal.</p></div><div className="planning-inline-controls"><label><span>Estratégia</span><select disabled={disabled} value={draft.debtStrategy} onChange={(event: ChangeEvent<HTMLSelectElement>) => onChange({ ...draft, debtStrategy: event.target.value as FinancialPlanDraft["debtStrategy"] })}><option value="avalanche">Maior juros</option><option value="snowball">Menor saldo</option><option value="priority">Prioridade manual</option></select></label><label><span>Extra mensal</span><input disabled={disabled} type="number" min={0} step="0.01" value={draft.extraDebtPayment} onChange={(event: ChangeEvent<HTMLInputElement>) => onChange({ ...draft, extraDebtPayment: Number(event.target.value) })} /></label></div></header>
      {simulation.debtPlan.length === 0 ? <p className="planning-empty-state">Nenhuma dívida ativa encontrada.</p> : <div className="planning-card-list">{simulation.debtPlan.map((item) => <article className={`planning-strategy-card planning-card-${item.health}`} key={item.debtId}><span className="planning-position">{item.strategyPosition}</span><div><strong>{item.name}</strong><p>{item.explanation}</p></div><dl><div><dt>Saldo</dt><dd>{formatCurrency(item.startingBalance)}</dd></div><div><dt>Pagamento mínimo</dt><dd>{formatCurrency(item.minimumPayment)}</dd></div><div><dt>Quitação</dt><dd>{item.projectedPayoffMonth ?? "Não estimada"}</dd></div><div><dt>Juros evitados</dt><dd>{formatCurrency(item.interestSavedEstimate)}</dd></div></dl></article>)}</div>}
    </section>
  );
}

export function PlanningGoals({ simulation }: { simulation: FinancialPlanSimulation }) {
  return (
    <section className="report-panel">
      <header className="report-panel-header"><div><h3>Priorização de metas</h3><p>O envelope é distribuído por prioridade e comparado com a data desejada.</p></div></header>
      {simulation.goalPlan.length === 0 ? <p className="planning-empty-state">Nenhuma meta ativa aguardando aporte.</p> : <div className="planning-card-list">{simulation.goalPlan.map((item) => <article className={`planning-strategy-card planning-card-${item.health}`} key={item.goalId}><span className="planning-goal-priority">{item.priority === "high" ? "Alta" : item.priority === "medium" ? "Média" : "Baixa"}</span><div><strong>{item.name}</strong><p>{item.explanation}</p></div><dl><div><dt>Aporte planejado</dt><dd>{formatCurrency(item.allocatedMonthlyAmount)}</dd></div><div><dt>Aporte necessário</dt><dd>{formatCurrency(item.requiredMonthlyAmount)}</dd></div><div><dt>Conclusão</dt><dd>{item.projectedCompletionMonth ?? "Não estimada"}</dd></div><div><dt>Meta</dt><dd>{item.targetMonth}</dd></div></dl></article>)}</div>}
    </section>
  );
}
