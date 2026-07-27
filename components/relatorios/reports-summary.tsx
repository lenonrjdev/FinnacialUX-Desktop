import {
  ArrowDownIcon,
  ArrowUpIcon,
  ReportsIcon,
  SavingsIcon,
} from "@/components/shared/icons";
import { reportsContent } from "@/content/relatorios";
import { formatCurrency, formatPercentage } from "@/lib/formatters";

export function ReportsSummary({
  income,
  expenses,
  result,
  savingsRate,
  averageIncome,
  averageExpenses,
}: {
  income: number;
  expenses: number;
  result: number;
  savingsRate: number;
  averageIncome: number;
  averageExpenses: number;
}) {
  const cards = [
    {
      key: "income",
      label: reportsContent.summary.income,
      value: formatCurrency(income),
      helper: `${reportsContent.summary.averageIncome}: ${formatCurrency(averageIncome)}`,
      icon: <ArrowDownIcon />,
      featured: true,
    },
    {
      key: "expenses",
      label: reportsContent.summary.expenses,
      value: formatCurrency(expenses),
      helper: `${reportsContent.summary.averageExpenses}: ${formatCurrency(averageExpenses)}`,
      icon: <ArrowUpIcon />,
    },
    {
      key: "result",
      label: reportsContent.summary.result,
      value: formatCurrency(result),
      helper: result >= 0 ? reportsContent.summary.positiveResult : reportsContent.summary.negativeResult,
      icon: <ReportsIcon />,
      alert: result < 0,
    },
    {
      key: "savings",
      label: reportsContent.summary.savingsRate,
      value: formatPercentage(savingsRate),
      helper: reportsContent.summary.savingsHelper,
      icon: <SavingsIcon />,
      alert: savingsRate < 10,
    },
  ];

  return (
    <section className="reports-summary-grid" aria-label={reportsContent.accessibility.summary}>
      {cards.map((card) => (
        <article
          className={`reports-summary-card ${card.featured ? "featured" : ""} ${card.alert ? "alert" : ""}`}
          key={card.key}
        >
          <span className="reports-summary-icon">{card.icon}</span>
          <span>{card.label}</span>
          <strong>{card.value}</strong>
          <small>{card.helper}</small>
        </article>
      ))}
    </section>
  );
}
