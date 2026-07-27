import { SearchIcon } from "@/components/shared/icons";
import { subscriptionsContent } from "@/content/assinaturas";
import type {
  SubscriptionAccountFilter,
  SubscriptionCategoryFilter,
  SubscriptionStatusFilter,
  SubscriptionView,
} from "@/types/assinaturas";

export function SubscriptionsToolbar({
  view,
  search,
  category,
  status,
  accountId,
  accounts,
  onViewChange,
  onSearchChange,
  onCategoryChange,
  onStatusChange,
  onAccountChange,
  onClear,
}: {
  view: SubscriptionView;
  search: string;
  category: SubscriptionCategoryFilter;
  status: SubscriptionStatusFilter;
  accountId: SubscriptionAccountFilter;
  accounts: Array<{ id: string; name: string }>;
  onViewChange: (value: SubscriptionView) => void;
  onSearchChange: (value: string) => void;
  onCategoryChange: (value: SubscriptionCategoryFilter) => void;
  onStatusChange: (value: SubscriptionStatusFilter) => void;
  onAccountChange: (value: SubscriptionAccountFilter) => void;
  onClear: () => void;
}) {
  return (
    <section className="subscriptions-toolbar">
      <div className="subscription-view-tabs" role="tablist" aria-label={subscriptionsContent.accessibility.viewTabs}>
        <button className={view === "subscriptions" ? "active" : ""} type="button" onClick={() => onViewChange("subscriptions")}>
          {subscriptionsContent.toolbar.subscriptions}
        </button>
        <button className={view === "charges" ? "active" : ""} type="button" onClick={() => onViewChange("charges")}>
          {subscriptionsContent.toolbar.charges}
        </button>
      </div>

      <label className="transactions-search subscription-search-field">
        <SearchIcon />
        <span className="sr-only">{subscriptionsContent.accessibility.search}</span>
        <input value={search} onChange={(event) => onSearchChange(event.target.value)} placeholder={subscriptionsContent.toolbar.searchPlaceholder} />
      </label>

      <label className="subscription-filter-field">
        <span>{subscriptionsContent.toolbar.categoryLabel}</span>
        <select value={category} onChange={(event) => onCategoryChange(event.target.value as SubscriptionCategoryFilter)}>
          <option value="all">{subscriptionsContent.toolbar.allCategories}</option>
          {Object.entries(subscriptionsContent.categories).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
      </label>

      <label className="subscription-filter-field">
        <span>{subscriptionsContent.toolbar.statusLabel}</span>
        <select value={status} onChange={(event) => onStatusChange(event.target.value as SubscriptionStatusFilter)}>
          <option value="all">{subscriptionsContent.toolbar.allStatuses}</option>
          {Object.entries(subscriptionsContent.statuses).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
      </label>

      <label className="subscription-filter-field">
        <span>{subscriptionsContent.toolbar.accountLabel}</span>
        <select value={accountId} onChange={(event) => onAccountChange(event.target.value)}>
          <option value="all">{subscriptionsContent.toolbar.allAccounts}</option>
          {accounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}
        </select>
      </label>

      <button className="clear-filters-button" type="button" onClick={onClear}>{subscriptionsContent.toolbar.clear}</button>
    </section>
  );
}
