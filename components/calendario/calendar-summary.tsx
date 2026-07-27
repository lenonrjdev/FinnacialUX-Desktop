import {
  CalendarIcon,
  CheckIcon,
  ClockIcon,
  IncomeIcon,
  WalletIcon,
} from "@/components/shared/icons";
import { calendarContent } from "@/content/calendario";
import { formatCurrency, formatSignedCurrency } from "@/lib/formatters";

type CalendarSummaryProps = {
  income: number;
  expenses: number;
  result: number;
  commitments: number;
  overdue: number;
  overdueCount: number;
};

export function CalendarSummary({
  income,
  expenses,
  result,
  commitments,
  overdue,
  overdueCount,
}: CalendarSummaryProps) {
  const cards = [
    {
      key: "income",
      label: calendarContent.summary.income,
      helper: calendarContent.summary.incomeHelper,
      value: formatCurrency(income),
      icon: <IncomeIcon />,
      featured: true,
    },
    {
      key: "expenses",
      label: calendarContent.summary.expenses,
      helper: calendarContent.summary.expensesHelper,
      value: formatCurrency(expenses),
      icon: <WalletIcon />,
    },
    {
      key: "result",
      label: calendarContent.summary.result,
      helper: calendarContent.summary.resultHelper,
      value: formatSignedCurrency(result),
      icon: <CheckIcon />,
      result,
    },
    {
      key: "commitments",
      label: calendarContent.summary.commitments,
      helper: calendarContent.summary.commitmentsHelper,
      value: String(commitments).padStart(2, "0"),
      icon: <CalendarIcon />,
    },
    {
      key: "overdue",
      label: calendarContent.summary.overdue,
      helper: calendarContent.summary.overdueHelper,
      value: formatCurrency(overdue),
      icon: <ClockIcon />,
      badge: overdueCount,
    },
  ];

  return (
    <section className="calendar-summary-grid" aria-label={calendarContent.summary.ariaLabel}>
      {cards.map((card) => (
        <article
          className={`calendar-summary-card ${card.featured ? "featured" : ""} ${typeof card.result === "number" && card.result < 0 ? "negative" : ""}`}
          key={card.key}
        >
          <div className="calendar-summary-card-top">
            <span className="calendar-summary-icon">{card.icon}</span>
            {typeof card.badge === "number" && card.badge > 0 ? (
              <span className="commitment-alert-badge">{card.badge}</span>
            ) : null}
          </div>
          <span>{card.label}</span>
          <strong>{card.value}</strong>
          <small>{card.helper}</small>
        </article>
      ))}
    </section>
  );
}
