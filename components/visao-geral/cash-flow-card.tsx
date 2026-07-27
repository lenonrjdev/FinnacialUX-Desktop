import { ArrowDownIcon } from "@/components/shared/icons";
import { overviewContent } from "@/content/visao-geral";
import type { FinancialOverviewData } from "@/lib/use-financial-overview";
import { formatCurrency } from "@/lib/formatters";

export function CashFlowCard({ data }: { data: FinancialOverviewData }) {
  const summaries = [
    {
      label: overviewContent.cashFlow.summaryLabels.income,
      value: data.cashFlowSummary.income,
    },
    {
      label: overviewContent.cashFlow.summaryLabels.expense,
      value: data.cashFlowSummary.expense,
    },
    {
      label: overviewContent.cashFlow.summaryLabels.result,
      value: data.cashFlowSummary.result,
    },
  ];

  return (
    <article className="finance-card cashflow-card">
      <header className="card-header">
        <div>
          <span className="card-kicker">{overviewContent.cashFlow.kicker}</span>
          <h2>{overviewContent.cashFlow.title}</h2>
        </div>
        <button type="button" className="period-button">
          {overviewContent.cashFlow.period}
          <ArrowDownIcon />
        </button>
      </header>

      <div className="chart-summary">
        {summaries.map((summary) => (
          <div key={summary.label}>
            <span>{summary.label}</span>
            <strong>{formatCurrency(summary.value)}</strong>
          </div>
        ))}
      </div>

      <div className="bar-chart" aria-label={overviewContent.cashFlow.chartAriaLabel}>
        <div className="chart-grid-lines" aria-hidden="true">
          <span />
          <span />
          <span />
          <span />
        </div>
        {data.cashFlowChart.map((item) => (
          <div className="chart-column" key={item.month}>
            <div className="chart-bars">
              <span
                className="chart-bar income"
                style={{ height: `${item.income}%` }}
                title={`${overviewContent.cashFlow.chartBarTitles.income} ${item.month}`}
              />
              <span
                className="chart-bar expense"
                style={{ height: `${item.expense}%` }}
                title={`${overviewContent.cashFlow.chartBarTitles.expense} ${item.month}`}
              />
            </div>
            <span className="chart-month">{item.month}</span>
          </div>
        ))}
      </div>

      <div className="chart-legend">
        <span><i className="income" /> {overviewContent.cashFlow.legend.income}</span>
        <span><i className="expense" /> {overviewContent.cashFlow.legend.expense}</span>
      </div>
    </article>
  );
}
