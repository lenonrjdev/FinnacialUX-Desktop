import { reportsContent } from "@/content/relatorios";
import { formatCurrency, formatPercentage } from "@/lib/formatters";
import type { ProjectionCommitmentSummary } from "@/types/relatorios";

export function ProjectionCommitments({ commitments }: { commitments: ProjectionCommitmentSummary }) {
  const total = Object.values(commitments).reduce((sum, value) => sum + value, 0);
  const rows = [
    [reportsContent.projection.essential, commitments.essentialExpenses],
    [reportsContent.projection.subscriptions, commitments.subscriptions],
    [reportsContent.projection.debts, commitments.debts],
    [reportsContent.projection.installments, commitments.installments],
    [reportsContent.projection.goals, commitments.goals],
    [reportsContent.projection.variable, commitments.variableExpenses],
  ] as const;

  return (
    <article className="report-panel projection-commitments-panel">
      <header className="report-panel-header">
        <div>
          <h2>{reportsContent.projection.commitmentsTitle}</h2>
          <p>{reportsContent.projection.commitmentsDescription}</p>
        </div>
        <div className="report-total-caption">
          <span>{reportsContent.projection.expenses}</span>
          <strong>{formatCurrency(total)}</strong>
        </div>
      </header>

      <div className="projection-commitment-list">
        {rows.map(([label, amount], index) => (
          <div className="projection-commitment-row" key={label}>
            <span className={`projection-commitment-dot tone-${(index % 5) + 1}`} />
            <div>
              <strong>{label}</strong>
              <span>{formatPercentage(total > 0 ? (amount / total) * 100 : 0)}</span>
            </div>
            <strong>{formatCurrency(amount)}</strong>
          </div>
        ))}
      </div>
    </article>
  );
}
