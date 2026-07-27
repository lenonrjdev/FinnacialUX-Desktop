import { SavingsIcon, TargetIcon, WalletIcon, IncomeIcon } from "@/components/shared/icons";
import { goalsContent } from "@/content/metas";
import { formatCurrency } from "@/lib/formatters";

export function GoalsSummary({
  target,
  saved,
  remaining,
  monthly,
}: {
  target: number;
  saved: number;
  remaining: number;
  monthly: number;
}) {
  const cards = [
    {
      label: goalsContent.summary.target,
      value: formatCurrency(target),
      hint: goalsContent.summary.targetHint,
      icon: <TargetIcon />,
      featured: true,
    },
    {
      label: goalsContent.summary.saved,
      value: formatCurrency(saved),
      hint: goalsContent.summary.savedHint,
      icon: <SavingsIcon />,
    },
    {
      label: goalsContent.summary.remaining,
      value: formatCurrency(remaining),
      hint: goalsContent.summary.remainingHint,
      icon: <WalletIcon />,
    },
    {
      label: goalsContent.summary.monthly,
      value: formatCurrency(monthly),
      hint: goalsContent.summary.monthlyHint,
      icon: <IncomeIcon />,
    },
  ];

  return (
    <section className="goals-summary-grid" aria-label={goalsContent.accessibility.summary}>
      {cards.map((card) => (
        <article className={`goal-summary-card ${card.featured ? "featured" : ""}`} key={card.label}>
          <span className="goal-summary-icon">{card.icon}</span>
          <span>{card.label}</span>
          <strong>{card.value}</strong>
          <small>{card.hint}</small>
        </article>
      ))}
    </section>
  );
}
