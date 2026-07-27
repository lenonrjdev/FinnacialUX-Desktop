import { CreditCardIcon } from "@/components/shared/icons";
import { CreditCardItem } from "@/components/cartoes/credit-card-item";
import { cardsContent } from "@/content/cartoes";
import type { CreditCard } from "@/types/cartoes";

export function CreditCardsSection({
  cards,
  selectedCardId,
  onSelect,
}: {
  cards: CreditCard[];
  selectedCardId: string;
  onSelect: (cardId: string) => void;
}) {
  return (
    <section className="credit-cards-section">
      <header className="cards-section-heading">
        <div>
          <span>{cardsContent.cards.kicker}</span>
          <h2>{cardsContent.cards.title}</h2>
        </div>
        <small>{cards.length} {cardsContent.cards.countSuffix}</small>
      </header>

      {cards.length ? (
        <div className="credit-cards-grid">
          {cards.map((card) => (
            <CreditCardItem
              key={card.id}
              card={card}
              selected={selectedCardId === card.id}
              onSelect={() => onSelect(card.id)}
            />
          ))}
        </div>
      ) : (
        <div className="cards-empty-state">
          <span><CreditCardIcon /></span>
          <strong>{cardsContent.cards.emptyTitle}</strong>
          <p>{cardsContent.cards.emptyDescription}</p>
        </div>
      )}
    </section>
  );
}
