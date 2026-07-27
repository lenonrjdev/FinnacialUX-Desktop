import { SubscriptionCategoryIcon } from "@/components/assinaturas/subscription-icon";
import { CalendarIcon, TagIcon } from "@/components/shared/icons";
import { subscriptionsContent } from "@/content/assinaturas";
import { formatCurrency, formatShortDate } from "@/lib/formatters";
import type { SubscriptionCategory, SubscriptionRow } from "@/types/assinaturas";

export function SubscriptionInsights({
  subscriptions,
  selected,
}: {
  subscriptions: SubscriptionRow[];
  selected?: SubscriptionRow;
}) {
  const active = subscriptions.filter((item) => item.status === "active" || item.status === "trial");
  const categoryTotals = active.reduce<Record<string, number>>((totals, item) => {
    totals[item.category] = (totals[item.category] ?? 0) + item.monthlyEquivalent;
    return totals;
  }, {});
  const sortedCategories = Object.entries(categoryTotals).sort((a, b) => b[1] - a[1]);
  const maxCategoryValue = sortedCategories[0]?.[1] ?? 1;
  const upcoming = active
    .filter((item) => item.daysUntilCharge <= 30)
    .sort((a, b) => a.nextChargeDate.localeCompare(b.nextChargeDate));
  const opportunities = active.filter((item) => item.usage === "low" || item.status === "trial" || item.priceDifference > 0);
  const savingPotential = opportunities.reduce((total, item) => total + (item.usage === "low" || item.status === "trial" ? item.monthlyEquivalent : 0), 0);

  return (
    <div className="subscription-insights-column">
      {selected ? (
        <section className="subscription-selected-panel">
          <div className="subscription-selected-heading">
            <span className={`subscription-card-icon ${selected.category}`}><SubscriptionCategoryIcon category={selected.category} /></span>
            <div>
              <span className="section-eyebrow">{subscriptionsContent.list.monthlyEquivalent}</span>
              <h2>{selected.name}</h2>
              <p>{selected.provider}</p>
            </div>
          </div>
          <div className="subscription-selected-value">
            <strong>{formatCurrency(selected.annualEquivalent)}</strong>
            <span>{subscriptionsContent.summary.annualHelper}</span>
          </div>
          <div className="subscription-selected-data">
            <div><span>{subscriptionsContent.list.nextCharge}</span><strong>{formatShortDate(selected.nextChargeDate)}</strong></div>
            <div><span>{subscriptionsContent.toolbar.categoryLabel}</span><strong>{subscriptionsContent.categories[selected.category]}</strong></div>
            <div><span>{subscriptionsContent.subscriptionDialog.startDate}</span><strong>{formatShortDate(selected.startDate)}</strong></div>
            <div><span>{subscriptionsContent.subscriptionDialog.autoRenew}</span><strong>{selected.autoRenew ? "Sim" : "Não"}</strong></div>
          </div>
          {selected.notes ? <p className="subscription-selected-note">{selected.notes}</p> : null}
        </section>
      ) : null}

      <section className="subscription-insight-panel">
        <header>
          <div><span className="section-eyebrow">{subscriptionsContent.insights.breakdownEyebrow}</span><h2>{subscriptionsContent.insights.breakdownTitle}</h2></div>
        </header>
        {sortedCategories.length ? (
          <div className="subscription-category-breakdown">
            {sortedCategories.map(([category, value]) => (
              <div key={category}>
                <div className="subscription-breakdown-row">
                  <span className={`subscription-mini-icon ${category}`}><SubscriptionCategoryIcon category={category as SubscriptionCategory} /></span>
                  <div><strong>{subscriptionsContent.categories[category as SubscriptionCategory]}</strong><small>{formatCurrency(value)}/mês</small></div>
                  <b>{formatCurrency(value * 12)}</b>
                </div>
                <span className="subscription-breakdown-track"><i style={{ width: `${Math.max(8, (value / maxCategoryValue) * 100)}%` }} /></span>
              </div>
            ))}
          </div>
        ) : <p className="subscription-panel-empty">{subscriptionsContent.insights.breakdownEmpty}</p>}
      </section>

      <section className="subscription-insight-panel">
        <header>
          <div><span className="section-eyebrow">{subscriptionsContent.insights.upcomingEyebrow}</span><h2>{subscriptionsContent.insights.upcomingTitle}</h2></div>
          <CalendarIcon />
        </header>
        {upcoming.length ? (
          <div className="subscription-upcoming-list">
            {upcoming.slice(0, 5).map((item) => (
              <div key={item.id}>
                <span className={`subscription-upcoming-date ${item.daysUntilCharge < 0 ? "overdue" : ""}`}>
                  {item.daysUntilCharge < 0
                    ? subscriptionsContent.insights.overdue
                    : item.daysUntilCharge === 0
                      ? subscriptionsContent.insights.today
                      : `${item.daysUntilCharge} ${item.daysUntilCharge === 1 ? subscriptionsContent.insights.daysSingular : subscriptionsContent.insights.daysPlural}`}
                </span>
                <div><strong>{item.name}</strong><small>{formatShortDate(item.nextChargeDate)}</small></div>
                <b>{formatCurrency(item.amount)}</b>
              </div>
            ))}
          </div>
        ) : <p className="subscription-panel-empty">{subscriptionsContent.insights.upcomingEmpty}</p>}
      </section>

      <section className="subscription-insight-panel savings-panel">
        <header>
          <div><span className="section-eyebrow">{subscriptionsContent.insights.opportunitiesEyebrow}</span><h2>{subscriptionsContent.insights.opportunitiesTitle}</h2></div>
          <TagIcon />
        </header>
        {opportunities.length ? (
          <div className="subscription-opportunity-list">
            {opportunities.slice(0, 4).map((item) => (
              <div key={item.id}>
                <span className={`subscription-mini-icon ${item.category}`}><SubscriptionCategoryIcon category={item.category} /></span>
                <div>
                  <strong>{item.name}</strong>
                  <small>
                    {item.status === "trial"
                      ? subscriptionsContent.insights.trialEnding
                      : item.usage === "low"
                        ? subscriptionsContent.insights.lowUsage
                        : subscriptionsContent.insights.priceChanged}
                  </small>
                </div>
                <b>{formatCurrency(item.monthlyEquivalent)}</b>
              </div>
            ))}
            <footer><span>{subscriptionsContent.insights.estimatedSaving}</span><strong>{formatCurrency(savingPotential)}</strong></footer>
          </div>
        ) : <p className="subscription-panel-empty">{subscriptionsContent.insights.noOpportunities}</p>}
      </section>
    </div>
  );
}
