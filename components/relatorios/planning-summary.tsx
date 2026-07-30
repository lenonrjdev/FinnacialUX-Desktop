import { formatCurrency, formatPercentage } from "@/lib/formatters";
import type { FinancialPlanSimulation } from "@/types/financial-planning";

const healthLabels = { healthy: "Saudável", attention: "Atenção", critical: "Crítico" } as const;

export function PlanningSummary({ simulation }: { simulation: FinancialPlanSimulation }) {
  const items = [
    { label: "Renda planejada", value: formatCurrency(simulation.summary.monthlyIncomeTarget), helper: `${formatPercentage(simulation.summary.allocationRate)} distribuídos` },
    { label: "Margem flexível", value: formatCurrency(simulation.summary.monthlyFlexible), helper: "Disponível para variações do mês" },
    { label: "Reserva projetada", value: `${simulation.summary.projectedReserveCoverageMonths.toFixed(1)} meses`, helper: `Atual: ${simulation.summary.reserveCoverageMonths.toFixed(1)} meses` },
    { label: "Dívidas", value: formatCurrency(simulation.summary.totalDebtBalance), helper: simulation.summary.projectedDebtFreeMonth ? `Quitação: ${simulation.summary.projectedDebtFreeMonth}` : "Sem data segura de quitação" },
    { label: "Metas no prazo", value: `${simulation.summary.onTrackGoals}/${simulation.summary.activeGoals}`, helper: "Com o envelope mensal atual" },
  ];
  return (
    <section className="planning-summary-grid" aria-label="Resumo do plano financeiro">
      {items.map((item) => (
        <article className="planning-summary-card" key={item.label}>
          <span>{item.label}</span>
          <strong>{item.value}</strong>
          <small>{item.helper}</small>
        </article>
      ))}
      <article className={`planning-summary-card planning-health-${simulation.summary.health}`}>
        <span>Saúde do plano</span>
        <strong>{healthLabels[simulation.summary.health]}</strong>
        <small>{simulation.canActivate ? "Pode ser ativado após confirmação" : "Revise os bloqueios da simulação"}</small>
      </article>
    </section>
  );
}
