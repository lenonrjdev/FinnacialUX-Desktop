import { BudgetIcon, BillsIcon, CheckIcon, WalletIcon } from "@/components/shared/icons";
import { budgetsContent } from "@/content/orcamentos";
import { formatCurrency, formatPercentage } from "@/lib/formatters";

export function BudgetsSummary({
  planned,
  spent,
  available,
  usage,
  attentionCount,
}: {
  planned: number;
  spent: number;
  available: number;
  usage: number;
  attentionCount: number;
}) {
  const cards = [
    {
      label: budgetsContent.summary.planned,
      value: formatCurrency(planned),
      hint: budgetsContent.summary.plannedHint,
      icon: <BudgetIcon />,
      featured: true,
    },
    {
      label: budgetsContent.summary.spent,
      value: formatCurrency(spent),
      hint: `${formatPercentage(usage)} ${budgetsContent.list.used}`,
      icon: <BillsIcon />,
    },
    {
      label: budgetsContent.summary.available,
      value: formatCurrency(available),
      hint: budgetsContent.summary.availableHint,
      icon: <WalletIcon />,
    },
    {
      label: budgetsContent.summary.attention,
      value: String(attentionCount),
      hint: budgetsContent.summary.attentionHint,
      icon: <CheckIcon />,
      badge: attentionCount,
    },
  ];

  return (
    <section className="budgets-summary-grid" aria-label={budgetsContent.accessibility.summary}>
      {cards.map((card) => (
        <article className={`budget-summary-card ${card.featured ? "featured" : ""}`} key={card.label}>
          <div className="transaction-summary-card-top">
            <span className="transaction-summary-icon">{card.icon}</span>
            {card.badge ? <span className="budget-attention-count">{card.badge}</span> : null}
          </div>
          <span>{card.label}</span>
          <strong>{card.value}</strong>
          <small>{card.hint}</small>
        </article>
      ))}
    </section>
  );
}
