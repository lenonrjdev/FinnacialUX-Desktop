import { SearchIcon } from "@/components/shared/icons";
import { payablesContent } from "@/content/contas-a-pagar";
import type { FinancialAccount } from "@/types/contas";
import type { PayableFilters, PayableStatus } from "@/types/contas-a-pagar";

type AccountsPayableFiltersProps = {
  filters: PayableFilters;
  categories: string[];
  accounts: FinancialAccount[];
  onChange: (filters: PayableFilters) => void;
};

export function AccountsPayableFilters({
  filters,
  categories,
  accounts,
  onChange,
}: AccountsPayableFiltersProps) {
  return (
    <section className="commitment-filters" aria-label="Filtros das contas a pagar">
      <label className="transactions-search">
        <SearchIcon />
        <span className="sr-only">Buscar contas a pagar</span>
        <input
          value={filters.search}
          onChange={(event) => onChange({ ...filters, search: event.target.value })}
          placeholder={payablesContent.filters.searchPlaceholder}
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
                status: event.target.value as "all" | PayableStatus,
              })
            }
          >
            <option value="all">{payablesContent.filters.allStatuses}</option>
            {Object.entries(payablesContent.statuses).map(([value, label]) => (
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
                period: event.target.value as PayableFilters["period"],
              })
            }
          >
            <option value="all">{payablesContent.filters.allPeriods}</option>
            {Object.entries(payablesContent.filters.periods).map(([value, label]) => (
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
            <option value="all">{payablesContent.filters.allCategories}</option>
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
            <option value="all">{payablesContent.filters.allAccounts}</option>
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
        {payablesContent.filters.clear}
      </button>
    </section>
  );
}
