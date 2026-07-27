import { SearchIcon } from "@/components/shared/icons";
import { accountsContent } from "@/content/contas";
import type { AccountFilter } from "@/types/contas";

export function AccountsFilters({
  filter,
  search,
  counts,
  onFilterChange,
  onSearchChange,
}: {
  filter: AccountFilter;
  search: string;
  counts: Record<AccountFilter, number>;
  onFilterChange: (filter: AccountFilter) => void;
  onSearchChange: (search: string) => void;
}) {
  const filters = Object.keys(accountsContent.filters.labels) as AccountFilter[];

  return (
    <div className="accounts-toolbar">
      <div className="accounts-filter-tabs" role="tablist" aria-label="Filtrar contas">
        {filters.map((item) => (
          <button
            className={filter === item ? "active" : ""}
            type="button"
            role="tab"
            aria-selected={filter === item}
            onClick={() => onFilterChange(item)}
            key={item}
          >
            <span>{accountsContent.filters.labels[item]}</span>
            <b>{counts[item]}</b>
          </button>
        ))}
      </div>

      <label className="accounts-search">
        <span className="sr-only">{accountsContent.filters.searchAriaLabel}</span>
        <SearchIcon />
        <input
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder={accountsContent.filters.searchPlaceholder}
        />
      </label>
    </div>
  );
}
