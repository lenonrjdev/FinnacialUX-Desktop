import { reportsContent } from "@/content/relatorios";
import { formatCurrency, formatPercentage } from "@/lib/formatters";
import type { CategoryReportRow } from "@/types/relatorios";

export function CategoryReport({ rows, total }: { rows: CategoryReportRow[]; total: number }) {
  return (
    <article className="report-panel category-report">
      <header className="report-panel-header">
        <div>
          <h2>{reportsContent.categories.title}</h2>
          <p>{reportsContent.categories.description}</p>
        </div>
        <div className="report-total-caption">
          <span>{reportsContent.categories.total}</span>
          <strong>{formatCurrency(total)}</strong>
        </div>
      </header>

      {rows.length ? (
        <div className="category-report-list">
          {rows.slice(0, 7).map((row, index) => (
            <div className="category-report-row" key={row.category}>
              <span className={`category-rank tone-${(index % 5) + 1}`}>{String(index + 1).padStart(2, "0")}</span>
              <div className="category-report-copy">
                <div>
                  <strong>{row.category}</strong>
                  <span>{formatPercentage(row.percentage)}</span>
                </div>
                <div className="category-report-track">
                  <span style={{ width: `${Math.min(row.percentage, 100)}%` }} />
                </div>
              </div>
              <strong className="category-report-value">{formatCurrency(row.amount)}</strong>
            </div>
          ))}
        </div>
      ) : (
        <p className="report-empty-state">{reportsContent.categories.empty}</p>
      )}
    </article>
  );
}
