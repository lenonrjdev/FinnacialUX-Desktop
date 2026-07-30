import { CheckIcon, ClockIcon, InfoIcon, WarningIcon } from "@/components/shared/icons";
import { intelligenceContent } from "@/content/intelligence";
import { formatCurrency, formatPercentage } from "@/lib/formatters";
import type { FinancialIntelligenceProjection } from "@/types/financial-intelligence";

function formatDate(value: string | null): string {
  if (!value) return "Sem previsão";
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" })
    .format(new Date(`${value}T12:00:00Z`));
}

export function IntelligenceTrajectory({ projection }: { projection: FinancialIntelligenceProjection }) {
  const maximum = Math.max(
    ...projection.monthly.map((row) => Math.abs(row.endingBalance)),
    Math.abs(projection.summary.startingBalance),
    1,
  );

  return (
    <article className="report-panel intelligence-trajectory-panel">
      <header className="report-panel-header">
        <div>
          <h2>{intelligenceContent.panels.trajectory}</h2>
          <p>{intelligenceContent.panels.trajectoryDescription}</p>
        </div>
      </header>
      <div className="intelligence-trajectory-chart" aria-label="Trajetória mensal do saldo projetado">
        {projection.monthly.map((row) => {
          const height = Math.max((Math.abs(row.endingBalance) / maximum) * 100, 5);
          return (
            <div className="intelligence-trajectory-column" key={row.month}>
              <div className="intelligence-trajectory-axis">
                <span
                  className={row.endingBalance < 0 ? "negative" : "positive"}
                  style={{ height: `${height}%` }}
                  title={`${row.label}: ${formatCurrency(row.endingBalance)}`}
                />
              </div>
              <strong>{row.shortLabel}</strong>
              <small>{formatCurrency(row.endingBalance)}</small>
              <em>{formatPercentage(row.confidence * 100)}</em>
            </div>
          );
        })}
      </div>
    </article>
  );
}

export function ActualVsExpectedPanel({ projection }: { projection: FinancialIntelligenceProjection }) {
  const row = projection.actualVsExpected;
  const items = [
    { label: "Receitas", expected: row.expectedIncome, actual: row.actualIncome, variance: row.incomeVariance, positiveWhenHigher: true },
    { label: "Despesas", expected: row.expectedExpenses, actual: row.actualExpenses, variance: row.expenseVariance, positiveWhenHigher: false },
    { label: "Resultado", expected: row.expectedResult, actual: row.actualResult, variance: row.actualResult - row.expectedResult, positiveWhenHigher: true },
  ];
  return (
    <article className="report-panel intelligence-actual-panel">
      <header className="report-panel-header">
        <div>
          <h2>{intelligenceContent.panels.actual}</h2>
          <p>{intelligenceContent.panels.actualDescription}</p>
        </div>
      </header>
      <div className="intelligence-actual-grid">
        {items.map((item) => {
          const healthy = item.positiveWhenHigher ? item.variance >= 0 : item.variance <= 0;
          return (
            <div key={item.label}>
              <span>{item.label}</span>
              <dl>
                <div><dt>Previsto</dt><dd>{formatCurrency(item.expected)}</dd></div>
                <div><dt>Realizado</dt><dd>{formatCurrency(item.actual)}</dd></div>
              </dl>
              <strong className={healthy ? "positive-value" : "negative-value"}>
                {item.variance >= 0 ? "+" : ""}{formatCurrency(item.variance)}
              </strong>
            </div>
          );
        })}
      </div>
    </article>
  );
}

export function IntelligenceAnomaliesPanel({ projection }: { projection: FinancialIntelligenceProjection }) {
  return (
    <article className="report-panel intelligence-anomalies-panel">
      <header className="report-panel-header">
        <div>
          <h2>{intelligenceContent.panels.anomalies}</h2>
          <p>{intelligenceContent.panels.anomaliesDescription}</p>
        </div>
      </header>
      {projection.anomalies.length === 0 ? (
        <div className="intelligence-empty-state"><CheckIcon />{intelligenceContent.empty.anomalies}</div>
      ) : (
        <div className="intelligence-anomaly-list">
          {projection.anomalies.map((anomaly) => (
            <div className={anomaly.severity} key={anomaly.id}>
              <span><WarningIcon /></span>
              <div>
                <header><strong>{anomaly.category}</strong><b>+{formatPercentage(anomaly.deviationPercent)}</b></header>
                <p>{formatCurrency(anomaly.currentAmount)} contra uma base de {formatCurrency(anomaly.baselineAmount)}.</p>
                <small>{anomaly.explanation}</small>
              </div>
            </div>
          ))}
        </div>
      )}
    </article>
  );
}

export function IntelligenceGoalsPanel({ projection }: { projection: FinancialIntelligenceProjection }) {
  return (
    <article className="report-panel intelligence-goals-panel">
      <header className="report-panel-header">
        <div>
          <h2>{intelligenceContent.panels.goals}</h2>
          <p>{intelligenceContent.panels.goalsDescription}</p>
        </div>
      </header>
      {projection.goals.length === 0 ? (
        <div className="intelligence-empty-state"><InfoIcon />{intelligenceContent.empty.goals}</div>
      ) : (
        <div className="intelligence-goal-list">
          {projection.goals.map((goal) => (
            <div className={goal.status} key={goal.goalId}>
              <span>{goal.status === "on-track" || goal.status === "completed" ? <CheckIcon /> : <ClockIcon />}</span>
              <div>
                <header><strong>{goal.name}</strong><b>{formatCurrency(goal.remainingAmount)}</b></header>
                <p>Conclusão estimada: {formatDate(goal.projectedCompletionDate)} · meta: {formatDate(goal.targetDate)}</p>
                <small>{goal.explanation}</small>
              </div>
            </div>
          ))}
        </div>
      )}
    </article>
  );
}

export function IntelligenceEventsTable({ projection }: { projection: FinancialIntelligenceProjection }) {
  const points = projection.daily.filter((point) => point.events.length > 0).slice(0, 80);
  return (
    <article className="report-panel intelligence-events-panel">
      <header className="report-panel-header">
        <div>
          <h2>{intelligenceContent.panels.events}</h2>
          <p>{intelligenceContent.panels.eventsDescription}</p>
        </div>
      </header>
      <div className="projection-table-scroll">
        <table className="projection-table intelligence-events-table">
          <thead>
            <tr><th>Data</th><th>Evento</th><th>Origem</th><th>Valor</th><th>Saldo após o dia</th></tr>
          </thead>
          <tbody>
            {points.flatMap((point) => point.events.map((event) => (
              <tr key={event.id}>
                <td>{formatDate(event.date)}</td>
                <td><strong>{event.label}</strong><small>{event.explanation}</small></td>
                <td>{event.kind.replaceAll("-", " ")}</td>
                <td className={event.direction === "income" ? "positive-value" : "negative-value"}>
                  {event.direction === "income" ? "+" : "-"}{formatCurrency(event.amount)}
                </td>
                <td>{formatCurrency(point.projectedBalance)}</td>
              </tr>
            ))) }
          </tbody>
        </table>
      </div>
    </article>
  );
}
