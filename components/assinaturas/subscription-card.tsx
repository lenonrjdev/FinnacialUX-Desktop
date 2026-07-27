import { SubscriptionCategoryIcon } from "@/components/assinaturas/subscription-icon";
import { CalendarIcon, MoreIcon, ReceiptIcon } from "@/components/shared/icons";
import { subscriptionsContent } from "@/content/assinaturas";
import { formatCurrency, formatPercentage, formatShortDate } from "@/lib/formatters";
import type { SubscriptionRow } from "@/types/assinaturas";

const cycleSuffix = {
  weekly: subscriptionsContent.list.perWeek,
  monthly: subscriptionsContent.list.perMonth,
  quarterly: subscriptionsContent.list.perQuarter,
  semiannual: subscriptionsContent.list.perSemester,
  annual: subscriptionsContent.list.perYear,
} as const;

export function SubscriptionCard({
  subscription,
  accountName,
  selected,
  onSelect,
  onCharge,
  onEdit,
  onTogglePause,
  onCancel,
}: {
  subscription: SubscriptionRow;
  accountName: string;
  selected: boolean;
  onSelect: () => void;
  onCharge: () => void;
  onEdit: () => void;
  onTogglePause: () => void;
  onCancel: () => void;
}) {
  const inactive = subscription.status === "cancelled";
  const hasPriceChange = subscription.priceDifference > 0 && subscription.previousAmount;

  return (
    <article
      className={`subscription-card ${selected ? "selected" : ""} ${inactive ? "cancelled" : ""}`}
      onClick={onSelect}
    >
      <header className="subscription-card-header">
        <div className="subscription-card-identity">
          <span className={`subscription-card-icon ${subscription.category}`}>
            <SubscriptionCategoryIcon category={subscription.category} />
          </span>
          <div>
            <div className="subscription-card-badges">
              <span className={`subscription-status-badge ${subscription.status}`}>
                {subscriptionsContent.statuses[subscription.status]}
              </span>
              {subscription.computedChargeStatus === "overdue" ? (
                <span className="subscription-due-badge overdue">{subscriptionsContent.insights.overdue}</span>
              ) : null}
              {subscription.status === "trial" ? (
                <span className="subscription-due-badge trial">{subscriptionsContent.statuses.trial}</span>
              ) : null}
            </div>
            <h3>{subscription.name}</h3>
            <p>{subscription.provider}</p>
          </div>
        </div>
        <button
          className="subscription-menu-button"
          type="button"
          aria-label={`${subscriptionsContent.accessibility.subscriptionActions}: ${subscription.name}`}
          onClick={(event) => {
            event.stopPropagation();
            onEdit();
          }}
        >
          <MoreIcon />
        </button>
      </header>

      <div className="subscription-card-value-row">
        <div>
          <strong>{formatCurrency(subscription.amount)}</strong>
          <span>{cycleSuffix[subscription.billingCycle]}</span>
        </div>
        <div className="subscription-monthly-equivalent">
          <span>{subscriptionsContent.list.monthlyEquivalent}</span>
          <strong>{formatCurrency(subscription.monthlyEquivalent)}/mês</strong>
        </div>
      </div>

      <div className="subscription-card-details">
        <div>
          <span>{subscription.status === "trial" && subscription.trialEndsAt ? subscriptionsContent.list.trialEnds : subscriptionsContent.list.nextCharge}</span>
          <strong>{formatShortDate(subscription.status === "trial" && subscription.trialEndsAt ? subscription.trialEndsAt : subscription.nextChargeDate)}</strong>
        </div>
        <div>
          <span>{subscriptionsContent.toolbar.accountLabel}</span>
          <strong>{accountName}</strong>
        </div>
        <div>
          <span>{subscriptionsContent.list.usage}</span>
          <strong>{subscriptionsContent.usages[subscription.usage]}</strong>
        </div>
      </div>

      {hasPriceChange ? (
        <div className="subscription-price-alert">
          <span>{subscriptionsContent.list.priceIncrease} {formatCurrency(subscription.priceDifference)} ({formatPercentage(subscription.priceChangePercentage)})</span>
          {subscription.priceChangedAt ? <small>{subscriptionsContent.list.since} {formatShortDate(subscription.priceChangedAt)}</small> : null}
        </div>
      ) : null}

      <footer className="subscription-card-footer">
        <div className="subscription-renewal-line">
          <CalendarIcon />
          <span>{subscription.autoRenew ? subscriptionsContent.list.autoRenew : subscriptionsContent.list.manualRenew}</span>
        </div>
        <div className="subscription-card-actions">
          {!inactive ? (
            <>
              <button type="button" className="subscription-text-action" onClick={(event) => { event.stopPropagation(); onTogglePause(); }}>
                {subscription.status === "paused" ? subscriptionsContent.list.resume : subscriptionsContent.list.pause}
              </button>
              <button type="button" className="subscription-charge-button" onClick={(event) => { event.stopPropagation(); onCharge(); }}>
                <ReceiptIcon />
                {subscriptionsContent.list.recordCharge}
              </button>
              <button type="button" className="subscription-cancel-button" onClick={(event) => { event.stopPropagation(); onCancel(); }}>
                {subscriptionsContent.list.cancel}
              </button>
            </>
          ) : (
            <span className="subscription-cancelled-label">{subscriptionsContent.list.cancelled}</span>
          )}
        </div>
      </footer>
    </article>
  );
}
