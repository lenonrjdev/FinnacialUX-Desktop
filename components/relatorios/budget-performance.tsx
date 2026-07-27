import { reportsContent } from "@/content/relatorios";
import { formatCurrency, formatPercentage } from "@/lib/formatters";
import type { BudgetReportRow } from "@/types/relatorios";

export function BudgetPerformance({ rows }: { rows: BudgetReportRow[] }) {
  return (
    <article className="report-panel budget-performance-report">
      <header className="report-panel-header">
        <div>
          <h2>{reportsContent.budget.title}</h2>
          <p>{reportsContent.budget.description}</p>
        </div>
      </header>

      <div className="budget-performance-list">
        {rows.slice(0, 7).map((row) => (
          <div className="budget-performance-row" key={row.category}>
            <div className="budget-performance-title">
              <strong>{row.category}</strong>
              <span className={`report-status ${row.status}`}>
                {reportsContent.budget[row.status]}
              </span>
            </div>
            <div className="budget-performance-track">
              <span className={row.status} style={{ width: `${Math.min(row.usage, 100)}%` }} />
            </div>
            <div className="budget-performance-values">
              <span>{reportsContent.budget.actual}: <strong>{formatCurrency(row.actual)}</strong></span>
              <span>{reportsContent.budget.planned}: <strong>{formatCurrency(row.planned)}</strong></span>
              <span>{formatPercentage(row.usage)}</span>
            </div>
          </div>
        ))}
      </div>
    </article>
  );
}
