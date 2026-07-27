import { CreditCardIcon, PlusIcon, ShoppingBagIcon } from "@/components/shared/icons";
import { cardsContent } from "@/content/cartoes";

export function CardsHeading({
  onNewPurchase,
  onNewCard,
}: {
  onNewPurchase: () => void;
  onNewCard: () => void;
}) {
  return (
    <header className="cards-heading">
      <div>
        <span className="page-eyebrow">{cardsContent.heading.eyebrow}</span>
        <h1>{cardsContent.heading.title}</h1>
        <p>{cardsContent.heading.description}</p>
      </div>

      <div className="cards-heading-actions">
        <button className="secondary-action-button" type="button" onClick={onNewPurchase}>
          <ShoppingBagIcon />
          {cardsContent.heading.newPurchaseAction}
        </button>
        <button className="primary-action-button" type="button" onClick={onNewCard}>
          <PlusIcon />
          {cardsContent.heading.newCardAction}
        </button>
      </div>
    </header>
  );
}
