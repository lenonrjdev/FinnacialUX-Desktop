import { SubscriptionCard } from "@/components/assinaturas/subscription-card";
import { SubscriptionIcon } from "@/components/shared/icons";
import { subscriptionsContent } from "@/content/assinaturas";
import type { SubscriptionRow } from "@/types/assinaturas";

export function SubscriptionsList({
  subscriptions,
  accountNames,
  selectedId,
  onSelect,
  onCharge,
  onEdit,
  onTogglePause,
  onCancel,
}: {
  subscriptions: SubscriptionRow[];
  accountNames: Record<string, string>;
  selectedId: string;
  onSelect: (subscription: SubscriptionRow) => void;
  onCharge: (subscription: SubscriptionRow) => void;
  onEdit: (subscription: SubscriptionRow) => void;
  onTogglePause: (subscription: SubscriptionRow) => void;
  onCancel: (subscription: SubscriptionRow) => void;
}) {
  return (
    <section className="subscriptions-list-card">
      <header className="subscriptions-list-header">
        <div>
          <span className="section-eyebrow">{subscriptionsContent.list.eyebrow}</span>
          <h2>{subscriptionsContent.list.title}</h2>
        </div>
        <span>{subscriptions.length} {subscriptions.length === 1 ? subscriptionsContent.list.resultSingular : subscriptionsContent.list.resultPlural}</span>
      </header>

      {subscriptions.length ? (
        <div className="subscriptions-card-grid">
          {subscriptions.map((subscription) => (
            <SubscriptionCard
              key={subscription.id}
              subscription={subscription}
              accountName={accountNames[subscription.accountId] ?? subscriptionsContent.list.unknownAccount}
              selected={subscription.id === selectedId}
              onSelect={() => onSelect(subscription)}
              onCharge={() => onCharge(subscription)}
              onEdit={() => onEdit(subscription)}
              onTogglePause={() => onTogglePause(subscription)}
              onCancel={() => onCancel(subscription)}
            />
          ))}
        </div>
      ) : (
        <div className="subscriptions-empty-state">
          <span><SubscriptionIcon /></span>
          <strong>{subscriptionsContent.list.emptyTitle}</strong>
          <p>{subscriptionsContent.list.emptyDescription}</p>
        </div>
      )}
    </section>
  );
}
