import type { ChangeEvent } from "react";
import { formatCurrency } from "@/lib/formatters";
import type { FinancialPlanDraft, FinancialPlanSimulation, PlanningAllocationKey } from "@/types/financial-planning";

const editableKeys: Array<Exclude<PlanningAllocationKey, "flexible">> = ["essentials", "lifestyle", "debts", "goals", "reserve"];
const labels = { essentials: "Essenciais", lifestyle: "Estilo de vida", debts: "Dívidas", goals: "Metas", reserve: "Reserva" } as const;

export function PlanningAllocationEditor({
  draft,
  simulation,
  disabled,
  onChange,
}: {
  draft: FinancialPlanDraft;
  simulation: FinancialPlanSimulation;
  disabled: boolean;
  onChange: (draft: FinancialPlanDraft) => void;
}) {
  function setPercentage(key: Exclude<PlanningAllocationKey, "flexible">, value: number) {
    onChange({ ...draft, allocationPercentages: { ...draft.allocationPercentages, [key]: value } });
  }
  return (
    <div className="planning-editor-layout">
      <section className="report-panel planning-form-panel">
        <header className="report-panel-header"><div><h3>Estrutura do plano</h3><p>Defina o período, a renda de referência e os envelopes mensais.</p></div></header>
        <div className="planning-field-grid">
          <label><span>Nome do plano</span><input disabled={disabled} value={draft.name} maxLength={80} onChange={(event: ChangeEvent<HTMLInputElement>) => onChange({ ...draft, name: event.target.value })} /></label>
          <label><span>Início</span><input disabled={disabled} type="month" value={draft.startMonth} onChange={(event: ChangeEvent<HTMLInputElement>) => onChange({ ...draft, startMonth: event.target.value })} /></label>
          <label><span>Período</span><select disabled={disabled} value={draft.period} onChange={(event: ChangeEvent<HTMLSelectElement>) => onChange({ ...draft, period: event.target.value as FinancialPlanDraft["period"], durationMonths: event.target.value === "annual" ? 12 : draft.durationMonths })}><option value="monthly">Mensal contínuo</option><option value="annual">Plano anual</option></select></label>
          <label><span>Duração</span><input disabled={disabled || draft.period === "annual"} type="number" min={1} max={36} value={draft.durationMonths} onChange={(event: ChangeEvent<HTMLInputElement>) => onChange({ ...draft, durationMonths: Number(event.target.value) })} /></label>
          <label><span>Renda mensal alvo</span><input disabled={disabled} type="number" min={0} step="0.01" value={draft.monthlyIncomeTarget} onChange={(event: ChangeEvent<HTMLInputElement>) => onChange({ ...draft, monthlyIncomeTarget: Number(event.target.value) })} /><small>Use zero para adotar a projeção local.</small></label>
          <label><span>Meta da reserva</span><input disabled={disabled} type="number" min={1} max={24} step="0.5" value={draft.reserveTargetMonths} onChange={(event: ChangeEvent<HTMLInputElement>) => onChange({ ...draft, reserveTargetMonths: Number(event.target.value) })} /><small>Meses de despesas essenciais.</small></label>
        </div>
      </section>

      <section className="report-panel planning-form-panel">
        <header className="report-panel-header"><div><h3>Distribuição da renda</h3><p>A margem flexível é calculada automaticamente.</p></div></header>
        <div className="planning-allocation-list">
          {editableKeys.map((key) => {
            const row = simulation.allocations.find((item) => item.key === key);
            return (
              <label className="planning-allocation-row" key={key}>
                <span><strong>{labels[key]}</strong><small>{formatCurrency(row?.monthlyAmount ?? 0)} por mês</small></span>
                <div><input disabled={disabled} type="range" min={0} max={80} step={1} value={draft.allocationPercentages[key]} onChange={(event: ChangeEvent<HTMLInputElement>) => setPercentage(key, Number(event.target.value))} /><output>{draft.allocationPercentages[key]}%</output></div>
              </label>
            );
          })}
          {simulation.allocations.filter((item) => item.key === "flexible").map((row) => (
            <div className={`planning-allocation-row planning-allocation-${row.health}`} key={row.key}>
              <span><strong>{row.label}</strong><small>{row.explanation}</small></span>
              <div><output>{row.percentage}%</output><strong>{formatCurrency(row.monthlyAmount)}</strong></div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
