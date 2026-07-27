import { BudgetIcon, ReportsIcon } from "@/components/shared/icons";
import { budgetsContent } from "@/content/orcamentos";
import { formatCurrency, formatPercentage } from "@/lib/formatters";
import type { BudgetRow } from "@/types/orcamentos";

export function BudgetInsightPanel({
  rows,
  monthElapsed,
  budgetUsed,
  projected,
}: {
  rows: BudgetRow[];
  monthElapsed: number;
  budgetUsed: number;
  projected: number;
}) {
  const largest = [...rows].sort((a, b) => b.spent - a.spent)[0];
  const warning = budgetUsed > monthElapsed + 4;
  const topAllocation = [...rows].sort((a, b) => b.limit - a.limit).slice(0, 5);
  const totalPlanned = rows.reduce((total, row) => total + row.limit, 0);

  return (
    <aside className="budget-insight-column">
      <section className="budget-insight-panel">
        <header>
          <span className="budget-insight-icon"><ReportsIcon /></span>
          <div>
            <span className="section-eyebrow">{budgetsContent.insight.eyebrow}</span>
            <h2>{budgetsContent.insight.title}</h2>
          </div>
        </header>
        <p>{budgetsContent.insight.description}</p>

        <div className="budget-pace-comparison">
          <div>
            <span>{budgetsContent.insight.monthElapsed}</span>
            <strong>{formatPercentage(monthElapsed)}</strong>
            <div className="budget-pace-track"><span style={{ width: `${Math.min(monthElapsed, 100)}%` }} /></div>
          </div>
          <div>
            <span>{budgetsContent.insight.budgetUsed}</span>
            <strong>{formatPercentage(budgetUsed)}</strong>
            <div className={`budget-pace-track ${warning ? "warning" : "healthy"}`}><span style={{ width: `${Math.min(budgetUsed, 100)}%` }} /></div>
          </div>
        </div>

        <div className="budget-insight-stats">
          <div>
            <span>{budgetsContent.insight.projected}</span>
            <strong>{formatCurrency(projected)}</strong>
          </div>
          <div>
            <span>{budgetsContent.insight.largestCategory}</span>
            <strong>{largest?.category.name ?? "—"}</strong>
          </div>
        </div>

        <div className={`budget-pace-message ${warning ? "warning" : "healthy"}`}>
          <BudgetIcon />
          <div>
            <strong>{warning ? budgetsContent.insight.warningTitle : budgetsContent.insight.controlledTitle}</strong>
            <p>{warning ? budgetsContent.insight.warningDescription : budgetsContent.insight.controlledDescription}</p>
          </div>
        </div>
      </section>

      <section className="budget-allocation-panel">
        <header>
          <h2>{budgetsContent.insight.allocationTitle}</h2>
          <p>{budgetsContent.insight.allocationDescription}</p>
        </header>
        <div className="budget-allocation-list">
          {topAllocation.map((row) => {
            const share = totalPlanned > 0 ? (row.limit / totalPlanned) * 100 : 0;
            return (
              <div key={row.id}>
                <div>
                  <span>{row.category.name}</span>
                  <strong>{formatPercentage(share)}</strong>
                </div>
                <div className="budget-allocation-track"><span style={{ width: `${share}%` }} /></div>
              </div>
            );
          })}
        </div>
      </section>
    </aside>
  );
}
