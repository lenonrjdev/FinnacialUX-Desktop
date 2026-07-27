import { ReceiptIcon } from "@/components/shared/icons";
import { subscriptionsContent } from "@/content/assinaturas";
import { formatCurrency, formatShortDate } from "@/lib/formatters";
import type { PersonalSubscription, SubscriptionCharge } from "@/types/assinaturas";

export function ChargesList({
  charges,
  subscriptions,
  accountNames,
}: {
  charges: SubscriptionCharge[];
  subscriptions: PersonalSubscription[];
  accountNames: Record<string, string>;
}) {
  const subscriptionNames = Object.fromEntries(subscriptions.map((item) => [item.id, item.name]));

  return (
    <section className="subscription-charges-card">
      <header className="subscriptions-list-header">
        <div><span className="section-eyebrow">{subscriptionsContent.charges.eyebrow}</span><h2>{subscriptionsContent.charges.title}</h2></div>
        <span>{charges.length} {charges.length === 1 ? subscriptionsContent.charges.resultSingular : subscriptionsContent.charges.resultPlural}</span>
      </header>

      {charges.length ? (
        <div className="subscription-charges-table-wrap">
          <table className="subscription-charges-table">
            <thead><tr><th>{subscriptionsContent.charges.date}</th><th>{subscriptionsContent.charges.subscription}</th><th>{subscriptionsContent.charges.account}</th><th>{subscriptionsContent.charges.status}</th><th>{subscriptionsContent.charges.note}</th><th>{subscriptionsContent.charges.amount}</th></tr></thead>
            <tbody>
              {charges.map((charge) => (
                <tr key={charge.id}>
                  <td>{formatShortDate(charge.date)}</td>
                  <td><strong>{subscriptionNames[charge.subscriptionId] ?? subscriptionsContent.charges.removedSubscription}</strong></td>
                  <td>{accountNames[charge.accountId] ?? subscriptionsContent.list.unknownAccount}</td>
                  <td><span className={`subscription-charge-status ${charge.status}`}>{subscriptionsContent.chargeStatuses[charge.status]}</span></td>
                  <td>{charge.note || "—"}</td>
                  <td><strong>{formatCurrency(charge.amount)}</strong></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="subscriptions-empty-state">
          <span><ReceiptIcon /></span>
          <strong>{subscriptionsContent.charges.emptyTitle}</strong>
          <p>{subscriptionsContent.charges.emptyDescription}</p>
        </div>
      )}
    </section>
  );
}
