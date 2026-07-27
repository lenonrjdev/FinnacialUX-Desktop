import { reportsContent } from "@/content/relatorios";
import { formatCurrency } from "@/lib/formatters";
import type { ProjectionMonth } from "@/types/relatorios";

export function ProjectionTable({ rows }: { rows: ProjectionMonth[] }) {
  return (
    <article className="report-panel projection-table-panel">
      <header className="report-panel-header">
        <div>
          <h2>{reportsContent.projection.title}</h2>
          <p>{reportsContent.projection.description}</p>
        </div>
      </header>

      <div className="projection-table-scroll">
        <table className="projection-table">
          <thead>
            <tr>
              <th>{reportsContent.projection.month}</th>
              <th>{reportsContent.projection.income}</th>
              <th>{reportsContent.projection.expenses}</th>
              <th>{reportsContent.projection.result}</th>
              <th>{reportsContent.projection.balance}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.month}>
                <td><strong>{row.label}</strong></td>
                <td className="positive-value">{formatCurrency(row.income)}</td>
                <td>{formatCurrency(row.totalExpenses)}</td>
                <td className={row.monthlyResult >= 0 ? "positive-value" : "negative-value"}>{formatCurrency(row.monthlyResult)}</td>
                <td className={row.projectedBalance >= 0 ? "" : "negative-value"}><strong>{formatCurrency(row.projectedBalance)}</strong></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </article>
  );
}
