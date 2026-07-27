import {
  CardChipIcon,
  CheckIcon,
  ChevronRightIcon,
  LockIcon,
} from "@/components/shared/icons";
import { cardsContent } from "@/content/cartoes";
import { formatCurrency, formatPercentage } from "@/lib/formatters";
import type { CreditCard } from "@/types/cartoes";

export function CreditCardItem({
  card,
  selected,
  onSelect,
}: {
  card: CreditCard;
  selected: boolean;
  onSelect: () => void;
}) {
  const available = Math.max(0, card.limit - card.usedLimit);
  const usage = card.limit ? Math.min(100, (card.usedLimit / card.limit) * 100) : 0;

  return (
    <article className={`credit-card-item ${selected ? "selected" : ""}`}>
      <div className={`credit-card-visual ${card.style}`}>
        <div className="credit-card-visual-top">
          <div>
            <span>{card.institution}</span>
            <strong>{card.name}</strong>
          </div>
          <span className="credit-card-chip"><CardChipIcon /></span>
        </div>

        <div className="credit-card-number">
          <span>••••</span><span>••••</span><span>••••</span><strong>{card.lastFourDigits}</strong>
        </div>

        <div className="credit-card-visual-bottom">
          <div>
            <span>{cardsContent.cards.ending}</span>
            <strong>{card.lastFourDigits}</strong>
          </div>
          <b>{cardsContent.brands[card.brand]}</b>
        </div>
      </div>

      <div className="credit-card-details">
        <div className="credit-card-detail-heading">
          <div>
            <span>{cardsContent.statuses[card.status]}</span>
            {card.isPrimary && <small>{cardsContent.cards.primary}</small>}
          </div>
          {selected && <i aria-label={cardsContent.cards.selected}><CheckIcon /></i>}
        </div>

        <div className="credit-card-limit-row">
          <div>
            <span>{cardsContent.cards.available}</span>
            <strong>{formatCurrency(available)}</strong>
          </div>
          <small>{formatPercentage(usage)} {cardsContent.cards.used.toLocaleLowerCase("pt-BR")}</small>
        </div>
        <div className="credit-card-limit-track" aria-hidden="true"><span style={{ width: `${usage}%` }} /></div>

        <div className="credit-card-dates">
          <span><LockIcon /> {cardsContent.cards.closes} {card.closingDay}</span>
          <span>{cardsContent.cards.due} {card.dueDay}</span>
        </div>

        <button type="button" onClick={onSelect}>
          {cardsContent.cards.viewInvoice}
          <ChevronRightIcon />
        </button>
      </div>
    </article>
  );
}
