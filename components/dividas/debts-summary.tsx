import { BillsIcon, CalendarIcon, DebtIcon, ReportsIcon, WalletIcon } from "@/components/shared/icons";
import { debtsContent } from "@/content/dividas";
import { formatCurrency, formatPercentage } from "@/lib/formatters";

export function DebtsSummary({
  outstanding,
  monthly,
  overdue,
  interest,
  debtFreeLabel,
  activeCount,
  debtToIncome,
}: {
  outstanding: number;
  monthly: number;
  overdue: number;
  interest: number;
  debtFreeLabel: string;
  activeCount: number;
  debtToIncome: number;
}) {
  const cards = [
    {
      key: "outstanding",
      label: debtsContent.summary.outstanding,
      value: formatCurrency(outstanding),
      helper: `${activeCount} ${activeCount === 1 ? debtsContent.summary.activeSingular : debtsContent.summary.activePlural}`,
      icon: <DebtIcon />,
      featured: true,
    },
    {
      key: "monthly",
      label: debtsContent.summary.monthly,
      value: formatCurrency(monthly),
      helper: `${formatPercentage(debtToIncome)} ${debtsContent.summary.incomeReference}`,
      icon: <WalletIcon />,
    },
    {
      key: "overdue",
      label: debtsContent.summary.overdue,
      value: formatCurrency(overdue),
      helper: debtsContent.summary.overdueHelper,
      icon: <BillsIcon />,
      alert: overdue > 0,
    },
    {
      key: "interest",
      label: debtsContent.summary.interest,
      value: formatCurrency(interest),
      helper: debtsContent.summary.interestHelper,
      icon: <ReportsIcon />,
    },
    {
      key: "debt-free",
      label: debtsContent.summary.debtFree,
      value: debtFreeLabel,
      helper: debtsContent.summary.debtFreeHelper,
      icon: <CalendarIcon />,
    },
  ];

  return (
    <section className="debt-summary-grid" aria-label={debtsContent.accessibility.summary}>
      {cards.map((card) => (
        <article className={`debt-summary-card ${card.featured ? "featured" : ""} ${card.alert ? "alert" : ""}`} key={card.key}>
          <div className="debt-summary-card-top">
            <span className="debt-summary-icon">{card.icon}</span>
            {card.alert ? <span className="debt-summary-alert">{debtsContent.summary.attention}</span> : null}
          </div>
          <span>{card.label}</span>
          <strong>{card.value}</strong>
          <small>{card.helper}</small>
        </article>
      ))}
    </section>
  );
}
