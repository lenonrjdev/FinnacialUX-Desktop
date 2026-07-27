import { CheckIcon, DebtIcon, SavingsIcon, TargetIcon } from "@/components/shared/icons";
import { reportsContent } from "@/content/relatorios";
import type { FinancialHealthItem } from "@/types/relatorios";

function itemIcon(id: string) {
  if (id === "commitments") return <DebtIcon />;
  if (id === "reserve") return <SavingsIcon />;
  if (id === "budget") return <TargetIcon />;
  return <CheckIcon />;
}

export function FinancialHealthPanel({ items }: { items: FinancialHealthItem[] }) {
  return (
    <article className="report-panel financial-health-panel">
      <header className="report-panel-header">
        <div>
          <h2>{reportsContent.health.title}</h2>
          <p>{reportsContent.health.description}</p>
        </div>
      </header>

      <div className="financial-health-list">
        {items.map((item) => (
          <div className={`financial-health-item ${item.status}`} key={item.id}>
            <span className="financial-health-icon">{itemIcon(item.id)}</span>
            <div>
              <span>{item.label}</span>
              <strong>{item.value}</strong>
              <small>{item.helper}</small>
            </div>
          </div>
        ))}
      </div>

      <div className="financial-recommendations">
        <strong>{reportsContent.health.recommendationsTitle}</strong>
        <ul>
          <li>{reportsContent.health.recommendationDebt}</li>
          <li>{reportsContent.health.recommendationReserve}</li>
          <li>{reportsContent.health.recommendationSubscriptions}</li>
        </ul>
      </div>
    </article>
  );
}
