import { CheckIcon, ClockIcon, DebtIcon } from "@/components/shared/icons";
import { reportsContent } from "@/content/relatorios";
import type { ProjectionMonth } from "@/types/relatorios";

export function ProjectionRisks({ rows }: { rows: ProjectionMonth[] }) {
  const hasNegativeMonth = rows.some((row) => row.monthlyResult < 0);
  const hasNegativeBalance = rows.some((row) => row.projectedBalance < 0);

  const alerts = [
    {
      key: "monthly",
      active: hasNegativeMonth,
      text: hasNegativeMonth ? reportsContent.projection.negativeMonth : reportsContent.projection.stableProjection,
      icon: hasNegativeMonth ? <DebtIcon /> : <CheckIcon />,
    },
    {
      key: "balance",
      active: hasNegativeBalance,
      text: hasNegativeBalance ? reportsContent.projection.negativeBalance : reportsContent.projection.stableProjection,
      icon: hasNegativeBalance ? <DebtIcon /> : <CheckIcon />,
    },
    {
      key: "relief",
      active: false,
      text: reportsContent.projection.debtRelief,
      icon: <ClockIcon />,
    },
  ];

  return (
    <article className="report-panel projection-risks-panel">
      <header className="report-panel-header">
        <div>
          <h2>{reportsContent.projection.risksTitle}</h2>
          <p>{reportsContent.projection.estimateDisclaimer}</p>
        </div>
      </header>

      <div className="projection-risk-list">
        {alerts.map((alert) => (
          <div className={alert.active ? "critical" : "positive"} key={alert.key}>
            <span>{alert.icon}</span>
            <p>{alert.text}</p>
          </div>
        ))}
      </div>
    </article>
  );
}
