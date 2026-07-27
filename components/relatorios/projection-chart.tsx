import { reportsContent } from "@/content/relatorios";
import { formatCurrency } from "@/lib/formatters";
import type { ProjectionMonth } from "@/types/relatorios";

export function ProjectionChart({ rows, startingBalance }: { rows: ProjectionMonth[]; startingBalance: number }) {
  const balances = [startingBalance, ...rows.map((row) => row.projectedBalance)];
  const maximum = Math.max(...balances.map((value) => Math.abs(value)), 1);

  return (
    <article className="report-panel projection-chart-panel">
      <header className="report-panel-header">
        <div>
          <h2>{reportsContent.projection.chartTitle}</h2>
          <p>{reportsContent.projection.chartDescription}</p>
        </div>
      </header>

      <div className="projection-balance-chart" aria-label={reportsContent.accessibility.projectionChart}>
        {rows.map((row) => {
          const height = Math.max((Math.abs(row.projectedBalance) / maximum) * 100, 4);
          return (
            <div className="projection-balance-column" key={row.month}>
              <div className="projection-balance-axis">
                <span
                  className={row.projectedBalance >= 0 ? "positive" : "negative"}
                  style={{ height: `${height}%` }}
                  title={`${row.label}: ${formatCurrency(row.projectedBalance)}`}
                />
              </div>
              <strong>{row.shortLabel}</strong>
              <small>{formatCurrency(row.projectedBalance)}</small>
            </div>
          );
        })}
      </div>
    </article>
  );
}
