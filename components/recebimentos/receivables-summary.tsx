import {
  CalendarIcon,
  CheckIcon,
  ClockIcon,
  IncomeIcon,
  SubscriptionIcon,
} from "@/components/shared/icons";
import { receivablesContent } from "@/content/recebimentos";
import { formatCurrency } from "@/lib/formatters";

type ReceivablesSummaryProps = {
  received: number;
  expected: number;
  nextSevenDays: number;
  overdue: number;
  recurring: number;
  overdueCount: number;
};

export function ReceivablesSummary({
  received,
  expected,
  nextSevenDays,
  overdue,
  recurring,
  overdueCount,
}: ReceivablesSummaryProps) {
  const cards = [
    {
      key: "received",
      label: receivablesContent.summary.received,
      helper: receivablesContent.summary.receivedHelper,
      value: received,
      icon: <CheckIcon />,
      featured: true,
    },
    {
      key: "expected",
      label: receivablesContent.summary.expected,
      helper: receivablesContent.summary.expectedHelper,
      value: expected,
      icon: <IncomeIcon />,
    },
    {
      key: "seven-days",
      label: receivablesContent.summary.sevenDays,
      helper: receivablesContent.summary.sevenDaysHelper,
      value: nextSevenDays,
      icon: <CalendarIcon />,
    },
    {
      key: "overdue",
      label: receivablesContent.summary.overdue,
      helper: receivablesContent.summary.overdueHelper,
      value: overdue,
      icon: <ClockIcon />,
      badge: overdueCount,
    },
    {
      key: "recurring",
      label: receivablesContent.summary.recurring,
      helper: receivablesContent.summary.recurringHelper,
      value: recurring,
      icon: <SubscriptionIcon />,
    },
  ];

  return (
    <section className="commitment-summary-grid" aria-label="Resumo dos recebimentos">
      {cards.map((card) => (
        <article
          className={`commitment-summary-card ${card.featured ? "featured income-featured" : ""}`}
          key={card.key}
        >
          <div className="commitment-summary-card-top">
            <span className="commitment-summary-icon">{card.icon}</span>
            {typeof card.badge === "number" && card.badge > 0 ? (
              <span className="commitment-alert-badge">{card.badge}</span>
            ) : null}
          </div>
          <span>{card.label}</span>
          <strong>{formatCurrency(card.value)}</strong>
          <small>{card.helper}</small>
        </article>
      ))}
    </section>
  );
}
