import { calendarContent } from "@/content/calendario";
import { formatCurrency, formatSignedCurrency } from "@/lib/formatters";

type MonthProjectionProps = {
  income: number;
  expenses: number;
  completed: number;
  pending: number;
};

export function MonthProjection({ income, expenses, completed, pending }: MonthProjectionProps) {
  const result = income - expenses;
  const total = completed + pending;
  const completedPercentage = total > 0 ? Math.min(100, (completed / total) * 100) : 0;

  return (
    <section className="calendar-projection-panel">
      <header>
        <span className="section-eyebrow">{calendarContent.projection.eyebrow}</span>
        <h2>{calendarContent.projection.title}</h2>
        <p>{calendarContent.projection.description}</p>
      </header>

      <div className="calendar-projection-result">
        <span>{result >= 0 ? calendarContent.projection.positive : calendarContent.projection.negative}</span>
        <strong className={result < 0 ? "negative" : ""}>{formatSignedCurrency(result)}</strong>
      </div>

      <div className="calendar-projection-lines">
        <div><span>{calendarContent.projection.income}</span><strong>{formatCurrency(income)}</strong></div>
        <div><span>{calendarContent.projection.expenses}</span><strong>{formatCurrency(expenses)}</strong></div>
        <div><span>{calendarContent.projection.completed}</span><strong>{formatCurrency(completed)}</strong></div>
        <div><span>{calendarContent.projection.pending}</span><strong>{formatCurrency(pending)}</strong></div>
      </div>

      <div className="calendar-projection-progress" aria-label={`${completedPercentage.toFixed(0)}% ${calendarContent.projection.progressAriaSuffix}`}>
        <span style={{ width: `${completedPercentage}%` }} />
      </div>
    </section>
  );
}
