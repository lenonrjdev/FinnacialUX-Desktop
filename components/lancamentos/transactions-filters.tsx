import { SearchIcon } from "@/components/shared/icons";
import { transactionsContent } from "@/content/lancamentos";
import type {
  TransactionPeriod,
  TransactionStatus,
  TransactionType,
} from "@/types/lancamentos";

export type TransactionsFilterState = {
  query: string;
  type: TransactionType | "all";
  period: TransactionPeriod;
  status: TransactionStatus | "all";
  account: string;
};

export function TransactionsFilters({
  filters,
  accounts,
  onChange,
  onClear,
}: {
  filters: TransactionsFilterState;
  accounts: string[];
  onChange: (next: TransactionsFilterState) => void;
  onClear: () => void;
}) {
  return (
    <section className="transactions-filters" aria-label="Filtros de lançamentos">
      <label className="transactions-search">
        <SearchIcon />
        <span className="sr-only">{transactionsContent.filters.searchAriaLabel}</span>
        <input
          value={filters.query}
          onChange={(event) =>
            onChange({ ...filters, query: event.target.value })
          }
          placeholder={transactionsContent.filters.searchPlaceholder}
        />
      </label>

      <div className="transactions-filter-selects">
        <label>
          <span>{transactionsContent.filters.typeLabel}</span>
          <select
            value={filters.type}
            onChange={(event) =>
              onChange({
                ...filters,
                type: event.target.value as TransactionType | "all",
              })
            }
          >
            <option value="all">{transactionsContent.filters.allTypes}</option>
            {Object.entries(transactionsContent.types).map(([value, label]) => (
              <option value={value} key={value}>
                {label}
              </option>
            ))}
          </select>
        </label>

        <label>
          <span>{transactionsContent.filters.periodLabel}</span>
          <select
            value={filters.period}
            onChange={(event) =>
              onChange({
                ...filters,
                period: event.target.value as TransactionPeriod,
              })
            }
          >
            {transactionsContent.filters.periodOptions.map((option) => (
              <option value={option.value} key={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label>
          <span>{transactionsContent.filters.statusLabel}</span>
          <select
            value={filters.status}
            onChange={(event) =>
              onChange({
                ...filters,
                status: event.target.value as TransactionStatus | "all",
              })
            }
          >
            <option value="all">{transactionsContent.filters.allStatuses}</option>
            {Object.entries(transactionsContent.statuses).map(([value, label]) => (
              <option value={value} key={value}>
                {label}
              </option>
            ))}
          </select>
        </label>

        <label>
          <span>{transactionsContent.filters.accountLabel}</span>
          <select
            value={filters.account}
            onChange={(event) =>
              onChange({ ...filters, account: event.target.value })
            }
          >
            <option value="all">{transactionsContent.filters.allAccounts}</option>
            {accounts.map((account) => (
              <option value={account} key={account}>
                {account}
              </option>
            ))}
          </select>
        </label>
      </div>

      <button className="clear-filters-button" type="button" onClick={onClear}>
        {transactionsContent.filters.clear}
      </button>
    </section>
  );
}
