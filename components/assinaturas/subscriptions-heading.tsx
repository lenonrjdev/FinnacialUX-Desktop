import { PlusIcon, ReceiptIcon } from "@/components/shared/icons";
import { subscriptionsContent } from "@/content/assinaturas";

export function SubscriptionsHeading({
  onNewSubscription,
  onNewCharge,
}: {
  onNewSubscription: () => void;
  onNewCharge: () => void;
}) {
  return (
    <header className="financial-management-heading subscriptions-heading">
      <div>
        <span className="section-eyebrow">{subscriptionsContent.heading.eyebrow}</span>
        <h1>{subscriptionsContent.heading.title}</h1>
        <p>{subscriptionsContent.heading.description}</p>
      </div>
      <div className="transactions-heading-actions">
        <button className="secondary-action-button" type="button" onClick={onNewCharge}>
          <ReceiptIcon />
          {subscriptionsContent.heading.newCharge}
        </button>
        <button className="primary-action-button" type="button" onClick={onNewSubscription}>
          <PlusIcon />
          {subscriptionsContent.heading.newSubscription}
        </button>
      </div>
    </header>
  );
}
