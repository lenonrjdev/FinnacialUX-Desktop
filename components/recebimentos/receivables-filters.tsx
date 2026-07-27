import { SearchIcon } from "@/components/shared/icons";
import { receivablesContent } from "@/content/recebimentos";
import type { FinancialAccount } from "@/types/contas";
import type {
  ReceivableFilters,
  ReceivableStatus,
} from "@/types/recebimentos";

type ReceivablesFiltersProps = {
  filters: ReceivableFilters;
  categories: string[];
  accounts: FinancialAccount[];
  onChange: (filters: ReceivableFilters) => void;
};

export function ReceivablesFilters({
  filters,
  categories,
  accounts,
  onChange,
}: ReceivablesFiltersProps) {
  return (
    <section className="commitment-filters" aria-label="Filtros dos recebimentos">
      <label className="transactions-search">
        <SearchIcon />
        <span className="sr-only">Buscar recebimentos</span>
        <input
          value={filters.search}
          onChange={(event) => onChange({ ...filters, search: event.target.value })}
          placeholder={receivablesContent.filters.searchPlaceholder}
        />
      </label>

      <div className="commitment-filter-selects">
        <label>
          <span>Status</span>
          <select
            value={filters.status}
            onChange={(event) =>
              onChange({
                ...filters,
                status: event.target.value as "all" | ReceivableStatus,
              })
            }
          >
            <option value="all">{receivablesContent.filters.allStatuses}</option>
            {Object.entries(receivablesContent.statuses).map(([value, label]) => (
              <option value={value} key={value}>{label}</option>
            ))}
          </select>
        </label>

        <label>
          <span>Período</span>
          <select
            value={filters.period}
            onChange={(event) =>
              onChange({
                ...filters,
                period: event.target.value as ReceivableFilters["period"],
              })
            }
          >
            <option value="all">{receivablesContent.filters.allPeriods}</option>
            {Object.entries(receivablesContent.filters.periods).map(([value, label]) => (
              <option value={value} key={value}>{label}</option>
            ))}
          </select>
        </label>

        <label>
          <span>Categoria</span>
          <select
            value={filters.category}
            onChange={(event) => onChange({ ...filters, category: event.target.value })}
          >
            <option value="all">{receivablesContent.filters.allCategories}</option>
            {categories.map((category) => (
              <option value={category} key={category}>{category}</option>
            ))}
          </select>
        </label>

        <label>
          <span>Conta</span>
          <select
            value={filters.accountId}
            onChange={(event) => onChange({ ...filters, accountId: event.target.value })}
          >
            <option value="all">{receivablesContent.filters.allAccounts}</option>
            {accounts.map((account) => (
              <option value={account.id} key={account.id}>{account.name}</option>
            ))}
          </select>
        </label>
      </div>

      <button
        className="clear-filters-button"
        type="button"
        onClick={() =>
          onChange({
            search: "",
            status: "all",
            period: "all",
            category: "all",
            accountId: "all",
          })
        }
      >
        {receivablesContent.filters.clear}
      </button>
    </section>
  );
}
