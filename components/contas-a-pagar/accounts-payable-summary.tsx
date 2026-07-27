import {
  BillsIcon,
  CalendarIcon,
  CheckIcon,
  ClockIcon,
  ReceiptIcon,
} from "@/components/shared/icons";
import { payablesContent } from "@/content/contas-a-pagar";
import { formatCurrency } from "@/lib/formatters";

type PayablesSummaryProps = {
  pending: number;
  dueToday: number;
  nextSevenDays: number;
  overdue: number;
  paidThisMonth: number;
  overdueCount: number;
};

export function AccountsPayableSummary({
  pending,
  dueToday,
  nextSevenDays,
  overdue,
  paidThisMonth,
  overdueCount,
}: PayablesSummaryProps) {
  const cards = [
    {
      key: "pending",
      label: payablesContent.summary.pending,
      helper: payablesContent.summary.pendingHelper,
      value: pending,
      icon: <BillsIcon />,
      featured: true,
    },
    {
      key: "today",
      label: payablesContent.summary.today,
      helper: payablesContent.summary.todayHelper,
      value: dueToday,
      icon: <CalendarIcon />,
    },
    {
      key: "seven-days",
      label: payablesContent.summary.sevenDays,
      helper: payablesContent.summary.sevenDaysHelper,
      value: nextSevenDays,
      icon: <ClockIcon />,
    },
    {
      key: "overdue",
      label: payablesContent.summary.overdue,
      helper: payablesContent.summary.overdueHelper,
      value: overdue,
      icon: <ReceiptIcon />,
      badge: overdueCount,
    },
    {
      key: "paid",
      label: payablesContent.summary.paid,
      helper: payablesContent.summary.paidHelper,
      value: paidThisMonth,
      icon: <CheckIcon />,
    },
  ];

  return (
    <section className="commitment-summary-grid" aria-label="Resumo das contas a pagar">
      {cards.map((card) => (
        <article
          className={`commitment-summary-card ${card.featured ? "featured" : ""}`}
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
