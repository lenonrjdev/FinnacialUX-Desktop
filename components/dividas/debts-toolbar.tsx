import { SearchIcon } from "@/components/shared/icons";
import { debtsContent } from "@/content/dividas";
import type {
  DebtPriorityFilter,
  DebtStatusFilter,
  DebtTypeFilter,
  DebtView,
} from "@/types/dividas";

export function DebtsToolbar({
  view,
  search,
  type,
  status,
  priority,
  onViewChange,
  onSearchChange,
  onTypeChange,
  onStatusChange,
  onPriorityChange,
  onClear,
}: {
  view: DebtView;
  search: string;
  type: DebtTypeFilter;
  status: DebtStatusFilter;
  priority: DebtPriorityFilter;
  onViewChange: (value: DebtView) => void;
  onSearchChange: (value: string) => void;
  onTypeChange: (value: DebtTypeFilter) => void;
  onStatusChange: (value: DebtStatusFilter) => void;
  onPriorityChange: (value: DebtPriorityFilter) => void;
  onClear: () => void;
}) {
  return (
    <section className="debts-toolbar">
      <div className="debt-view-tabs" role="tablist" aria-label={debtsContent.accessibility.viewTabs}>
        <button className={view === "debts" ? "active" : ""} type="button" onClick={() => onViewChange("debts")}>{debtsContent.toolbar.debts}</button>
        <button className={view === "payments" ? "active" : ""} type="button" onClick={() => onViewChange("payments")}>{debtsContent.toolbar.payments}</button>
      </div>

      <label className="transactions-search debt-search-field">
        <SearchIcon />
        <span className="sr-only">{debtsContent.accessibility.search}</span>
        <input value={search} onChange={(event) => onSearchChange(event.target.value)} placeholder={debtsContent.toolbar.searchPlaceholder} />
      </label>

      <label className="debt-filter-field">
        <span>{debtsContent.toolbar.typeLabel}</span>
        <select value={type} onChange={(event) => onTypeChange(event.target.value as DebtTypeFilter)}>
          <option value="all">{debtsContent.toolbar.allTypes}</option>
          {Object.entries(debtsContent.types).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
      </label>

      <label className="debt-filter-field">
        <span>{debtsContent.toolbar.statusLabel}</span>
        <select value={status} onChange={(event) => onStatusChange(event.target.value as DebtStatusFilter)}>
          <option value="all">{debtsContent.toolbar.allStatuses}</option>
          {Object.entries(debtsContent.statuses).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
      </label>

      <label className="debt-filter-field">
        <span>{debtsContent.toolbar.priorityLabel}</span>
        <select value={priority} onChange={(event) => onPriorityChange(event.target.value as DebtPriorityFilter)}>
          <option value="all">{debtsContent.toolbar.allPriorities}</option>
          {Object.entries(debtsContent.priorities).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
      </label>

      <button className="clear-filters-button" type="button" onClick={onClear}>{debtsContent.toolbar.clear}</button>
    </section>
  );
}
