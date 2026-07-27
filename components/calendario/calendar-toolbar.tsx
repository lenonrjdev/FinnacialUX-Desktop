import {
  CalendarIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  TransactionsIcon,
  SearchIcon,
} from "@/components/shared/icons";
import { calendarContent } from "@/content/calendario";
import { financialIntelligenceContent } from "@/content/financial-intelligence";
import { formatMonthLabel } from "@/lib/calendar";
import type { FinancialAccount } from "@/types/contas";
import type {
  CalendarEventStatus,
  CalendarEventType,
  CalendarFilters,
  CalendarViewMode,
} from "@/types/calendario";

type CalendarToolbarProps = {
  monthKey: string;
  filters: CalendarFilters;
  viewMode: CalendarViewMode;
  accounts: FinancialAccount[];
  onPreviousMonth: () => void;
  onNextMonth: () => void;
  onToday: () => void;
  onFiltersChange: (filters: CalendarFilters) => void;
  onViewModeChange: (mode: CalendarViewMode) => void;
};

export function CalendarToolbar({
  monthKey,
  filters,
  viewMode,
  accounts,
  onPreviousMonth,
  onNextMonth,
  onToday,
  onFiltersChange,
  onViewModeChange,
}: CalendarToolbarProps) {
  return (
    <section className="calendar-toolbar" aria-label={calendarContent.toolbar.ariaLabel}>
      <div className="calendar-month-navigation">
        <button type="button" onClick={onPreviousMonth} aria-label={calendarContent.toolbar.previousMonth}>
          <ChevronLeftIcon />
        </button>
        <div>
          <span>{calendarContent.toolbar.periodLabel}</span>
          <strong>{formatMonthLabel(monthKey)}</strong>
        </div>
        <button type="button" onClick={onNextMonth} aria-label={calendarContent.toolbar.nextMonth}>
          <ChevronRightIcon />
        </button>
        <button className="calendar-today-button" type="button" onClick={onToday}>
          {calendarContent.toolbar.today}
        </button>
      </div>

      <div className="calendar-toolbar-right">
        <label className="transactions-search calendar-search-field">
          <SearchIcon />
          <span className="sr-only">{financialIntelligenceContent.calendar.searchLabel}</span>
          <input
            value={filters.search}
            onChange={(event) => onFiltersChange({ ...filters, search: event.target.value })}
            placeholder={financialIntelligenceContent.calendar.searchPlaceholder}
          />
        </label>

        <div className="calendar-filter-selects">
          <label>
            <span>{calendarContent.toolbar.typeLabel}</span>
            <select
              value={filters.type}
              onChange={(event) => onFiltersChange({ ...filters, type: event.target.value as "all" | CalendarEventType })}
            >
              <option value="all">{calendarContent.toolbar.allTypes}</option>
              {Object.entries(calendarContent.types).map(([value, label]) => (
                <option value={value} key={value}>{label}</option>
              ))}
            </select>
          </label>

          <label>
            <span>{calendarContent.toolbar.statusLabel}</span>
            <select
              value={filters.status}
              onChange={(event) => onFiltersChange({ ...filters, status: event.target.value as "all" | CalendarEventStatus })}
            >
              <option value="all">{calendarContent.toolbar.allStatuses}</option>
              {Object.entries(calendarContent.statuses).map(([value, label]) => (
                <option value={value} key={value}>{label}</option>
              ))}
            </select>
          </label>

          <label>
            <span>{calendarContent.toolbar.accountLabel}</span>
            <select
              value={filters.accountId}
              onChange={(event) => onFiltersChange({ ...filters, accountId: event.target.value })}
            >
              <option value="all">{calendarContent.toolbar.allAccounts}</option>
              {accounts.map((account) => (
                <option value={account.id} key={account.id}>{account.name}</option>
              ))}
            </select>
          </label>
        </div>

        <div className="calendar-view-toggle" aria-label={calendarContent.toolbar.viewAriaLabel}>
          <button
            className={viewMode === "month" ? "active" : ""}
            type="button"
            onClick={() => onViewModeChange("month")}
          >
            <CalendarIcon />
            {calendarContent.toolbar.monthView}
          </button>
          <button
            className={viewMode === "agenda" ? "active" : ""}
            type="button"
            onClick={() => onViewModeChange("agenda")}
          >
            <TransactionsIcon />
            {calendarContent.toolbar.agendaView}
          </button>
        </div>
      </div>
    </section>
  );
}
