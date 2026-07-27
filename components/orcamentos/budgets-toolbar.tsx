import {
  ChevronLeftIcon,
  ChevronRightIcon,
  CopyIcon,
  SearchIcon,
} from "@/components/shared/icons";
import { budgetsContent, monthNames } from "@/content/orcamentos";
import type { BudgetStatusFilter, BudgetView } from "@/types/orcamentos";

function formatMonth(monthKey: string): string {
  const [year, month] = monthKey.split("-").map(Number);
  return `${monthNames[month - 1]} de ${year}`;
}

export function BudgetsToolbar({
  monthKey,
  view,
  search,
  status,
  onPreviousMonth,
  onNextMonth,
  onCurrentMonth,
  onViewChange,
  onSearchChange,
  onStatusChange,
  onClear,
  onCopyPrevious,
}: {
  monthKey: string;
  view: BudgetView;
  search: string;
  status: BudgetStatusFilter;
  onPreviousMonth: () => void;
  onNextMonth: () => void;
  onCurrentMonth: () => void;
  onViewChange: (view: BudgetView) => void;
  onSearchChange: (value: string) => void;
  onStatusChange: (status: BudgetStatusFilter) => void;
  onClear: () => void;
  onCopyPrevious: () => void;
}) {
  return (
    <section className="budgets-toolbar">
      <div className="budget-month-navigation">
        <button type="button" className="budget-month-arrow" onClick={onPreviousMonth} aria-label={budgetsContent.toolbar.previousMonth}>
          <ChevronLeftIcon />
        </button>
        <div>
          <span>{budgetsContent.toolbar.periodLabel}</span>
          <strong>{formatMonth(monthKey)}</strong>
        </div>
        <button type="button" className="budget-month-arrow" onClick={onNextMonth} aria-label={budgetsContent.toolbar.nextMonth}>
          <ChevronRightIcon />
        </button>
        <button type="button" className="budget-current-month" onClick={onCurrentMonth}>
          {budgetsContent.toolbar.currentMonth}
        </button>
      </div>

      <div className="budget-view-tabs" role="tablist" aria-label={budgetsContent.accessibility.viewSelector}>
        <button type="button" className={view === "budgets" ? "active" : ""} onClick={() => onViewChange("budgets")}>
          {budgetsContent.views.budgets}
        </button>
        <button type="button" className={view === "categories" ? "active" : ""} onClick={() => onViewChange("categories")}>
          {budgetsContent.views.categories}
        </button>
      </div>

      {view === "budgets" ? (
        <div className="budgets-toolbar-filters">
          <label className="transactions-search">
            <SearchIcon />
            <span className="sr-only">{budgetsContent.toolbar.searchLabel}</span>
            <input value={search} onChange={(event) => onSearchChange(event.target.value)} placeholder={budgetsContent.toolbar.searchPlaceholder} />
          </label>
          <label className="budget-status-filter">
            <span>{budgetsContent.toolbar.statusLabel}</span>
            <select value={status} onChange={(event) => onStatusChange(event.target.value as BudgetStatusFilter)}>
              <option value="all">{budgetsContent.toolbar.allStatuses}</option>
              <option value="healthy">{budgetsContent.toolbar.healthy}</option>
              <option value="attention">{budgetsContent.toolbar.attention}</option>
              <option value="exceeded">{budgetsContent.toolbar.exceeded}</option>
            </select>
          </label>
          <button className="clear-filters-button" type="button" onClick={onClear}>{budgetsContent.toolbar.clear}</button>
          <button className="secondary-action-button budget-copy-button" type="button" onClick={onCopyPrevious}>
            <CopyIcon />
            {budgetsContent.toolbar.copyPrevious}
          </button>
        </div>
      ) : null}
    </section>
  );
}
