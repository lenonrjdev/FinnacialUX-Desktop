import { ArrowUpIcon, TargetIcon } from "@/components/shared/icons";
import { overviewContent } from "@/content/visao-geral";
import type { FinancialOverviewData } from "@/lib/use-financial-overview";
import { formatCurrency, formatPercentage } from "@/lib/formatters";

export function MonthlyPanel({ data }: { data: FinancialOverviewData }) {
  const panel = data.monthlyPanel;

  return (
    <article className="monthly-panel">
      <div className="monthly-panel-block">
        <div className="monthly-label-row">
          <span>{overviewContent.monthlyPanel.balanceLabel}</span>
          <span className="monthly-symbol positive"><ArrowUpIcon /></span>
        </div>
        <strong>{formatCurrency(panel.balance)}</strong>
        <small>
          {formatPercentage(panel.retainedPercentage)} {overviewContent.monthlyPanel.retainedSuffix}
        </small>
      </div>

      <div className="monthly-panel-block">
        <div className="monthly-label-row">
          <span>{overviewContent.monthlyPanel.budgetLabel}</span>
          <span>{formatPercentage(panel.budgetUsedPercentage)}</span>
        </div>
        <strong>{formatCurrency(panel.budgetUsed)}</strong>
        <div
          className="dark-progress"
          aria-label={`${formatPercentage(panel.budgetUsedPercentage)} ${overviewContent.monthlyPanel.budgetAriaSuffix}`}
        >
          <span style={{ width: `${panel.budgetUsedPercentage}%` }} />
        </div>
        <small>
          {formatCurrency(panel.budgetAvailable)} {overviewContent.monthlyPanel.budgetAvailableSuffix}
        </small>
      </div>

      <div className="monthly-panel-block">
        <div className="monthly-label-row">
          <span>{overviewContent.monthlyPanel.goalLabel}</span>
          <TargetIcon />
        </div>
        <strong>{panel.goal.name}</strong>
        <div className="goal-row">
          <span>
            {formatCurrency(panel.goal.current)} de {formatCurrency(panel.goal.target)}
          </span>
          <b>{formatPercentage(panel.goal.percentage)}</b>
        </div>
      </div>
    </article>
  );
}
