import { reportsContent } from "@/content/relatorios";
import { formatCurrency } from "@/lib/formatters";
import type { MonthlyFinancialSnapshot } from "@/types/relatorios";

export function CashFlowReport({ snapshots }: { snapshots: MonthlyFinancialSnapshot[] }) {
  const maximum = Math.max(...snapshots.flatMap((item) => [item.income, item.expenses]), 1);
  const ordered = snapshots.map((item) => ({ ...item, result: item.income - item.expenses }));
  const best = ordered.reduce((current, item) => (item.result > current.result ? item : current), ordered[0]);
  const worst = ordered.reduce((current, item) => (item.result < current.result ? item : current), ordered[0]);

  return (
    <article className="report-panel cash-flow-report">
      <header className="report-panel-header">
        <div>
          <h2>{reportsContent.cashFlow.title}</h2>
          <p>{reportsContent.cashFlow.description}</p>
        </div>
        <div className="cash-flow-legend" aria-hidden="true">
          <span><i className="income" />{reportsContent.cashFlow.income}</span>
          <span><i className="expense" />{reportsContent.cashFlow.expenses}</span>
        </div>
      </header>

      <div className="cash-flow-chart" aria-label={reportsContent.accessibility.cashFlowChart}>
        {ordered.map((item) => (
          <div className="cash-flow-column" key={item.month}>
            <div className="cash-flow-bars">
              <span
                className="cash-flow-bar income"
                style={{ height: `${Math.max((item.income / maximum) * 100, 4)}%` }}
                title={`${reportsContent.cashFlow.income}: ${formatCurrency(item.income)}`}
              />
              <span
                className="cash-flow-bar expense"
                style={{ height: `${Math.max((item.expenses / maximum) * 100, 4)}%` }}
                title={`${reportsContent.cashFlow.expenses}: ${formatCurrency(item.expenses)}`}
              />
            </div>
            <strong>{item.shortLabel}</strong>
            <small className={item.result >= 0 ? "positive" : "negative"}>{formatCurrency(item.result)}</small>
          </div>
        ))}
      </div>

      <footer className="cash-flow-highlights">
        <div>
          <span>{reportsContent.cashFlow.bestMonth}</span>
          <strong>{best.label}</strong>
          <small>{formatCurrency(best.result)}</small>
        </div>
        <div>
          <span>{reportsContent.cashFlow.worstMonth}</span>
          <strong>{worst.label}</strong>
          <small>{formatCurrency(worst.result)}</small>
        </div>
      </footer>
    </article>
  );
}
