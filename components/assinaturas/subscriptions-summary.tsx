import {
  CalendarIcon,
  ReportsIcon,
  SubscriptionIcon,
  TagIcon,
  WalletIcon,
} from "@/components/shared/icons";
import { subscriptionsContent } from "@/content/assinaturas";
import { formatCurrency } from "@/lib/formatters";

export function SubscriptionsSummary({
  monthlyEquivalent,
  annualEstimate,
  nextThirtyDays,
  activeCount,
  savingsPotential,
}: {
  monthlyEquivalent: number;
  annualEstimate: number;
  nextThirtyDays: number;
  activeCount: number;
  savingsPotential: number;
}) {
  const cards = [
    {
      key: "monthly",
      label: subscriptionsContent.summary.monthly,
      value: formatCurrency(monthlyEquivalent),
      helper: subscriptionsContent.summary.monthlyHelper,
      icon: <WalletIcon />,
      featured: true,
    },
    {
      key: "annual",
      label: subscriptionsContent.summary.annual,
      value: formatCurrency(annualEstimate),
      helper: subscriptionsContent.summary.annualHelper,
      icon: <ReportsIcon />,
    },
    {
      key: "next",
      label: subscriptionsContent.summary.nextThirtyDays,
      value: formatCurrency(nextThirtyDays),
      helper: subscriptionsContent.summary.nextThirtyDaysHelper,
      icon: <CalendarIcon />,
    },
    {
      key: "active",
      label: subscriptionsContent.summary.active,
      value: String(activeCount).padStart(2, "0"),
      helper: `${activeCount} ${activeCount === 1 ? subscriptionsContent.summary.activeSingular : subscriptionsContent.summary.activePlural}`,
      icon: <SubscriptionIcon />,
    },
    {
      key: "savings",
      label: subscriptionsContent.summary.savings,
      value: formatCurrency(savingsPotential),
      helper: subscriptionsContent.summary.savingsHelper,
      icon: <TagIcon />,
      alert: savingsPotential > 0,
    },
  ];

  return (
    <section className="subscription-summary-grid" aria-label={subscriptionsContent.accessibility.summary}>
      {cards.map((card) => (
        <article
          className={`subscription-summary-card ${card.featured ? "featured" : ""} ${card.alert ? "alert" : ""}`}
          key={card.key}
        >
          <div className="subscription-summary-card-top">
            <span className="subscription-summary-icon">{card.icon}</span>
            {card.alert ? <span className="subscription-summary-alert">{subscriptionsContent.summary.attention}</span> : null}
          </div>
          <span>{card.label}</span>
          <strong>{card.value}</strong>
          <small>{card.helper}</small>
        </article>
      ))}
    </section>
  );
}
