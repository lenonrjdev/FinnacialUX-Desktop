import { CloseIcon, SearchIcon } from "@/components/shared/icons";
import { goalsContent } from "@/content/metas";
import type { GoalFilter, GoalStatusFilter, GoalView } from "@/types/metas";

export function GoalsToolbar({
  view,
  search,
  type,
  status,
  onViewChange,
  onSearchChange,
  onTypeChange,
  onStatusChange,
  onClear,
}: {
  view: GoalView;
  search: string;
  type: GoalFilter;
  status: GoalStatusFilter;
  onViewChange: (value: GoalView) => void;
  onSearchChange: (value: string) => void;
  onTypeChange: (value: GoalFilter) => void;
  onStatusChange: (value: GoalStatusFilter) => void;
  onClear: () => void;
}) {
  return (
    <section className="goals-toolbar">
      <div className="goal-view-tabs" role="tablist" aria-label={goalsContent.heading.title}>
        <button className={view === "goals" ? "active" : ""} type="button" onClick={() => onViewChange("goals")}>{goalsContent.toolbar.goalsView}</button>
        <button className={view === "movements" ? "active" : ""} type="button" onClick={() => onViewChange("movements")}>{goalsContent.toolbar.movementsView}</button>
      </div>
      <label className="transaction-search-field goal-search-field">
        <span>{goalsContent.toolbar.searchLabel}</span>
        <div>
          <SearchIcon />
          <input value={search} onChange={(event) => onSearchChange(event.target.value)} placeholder={goalsContent.toolbar.searchPlaceholder} />
        </div>
      </label>
      <label className="goal-filter-field">
        <span>{goalsContent.toolbar.typeLabel}</span>
        <select value={type} onChange={(event) => onTypeChange(event.target.value as GoalFilter)}>
          <option value="all">{goalsContent.toolbar.allTypes}</option>
          <option value="reserve">{goalsContent.toolbar.reserves}</option>
          <option value="goal">{goalsContent.toolbar.goals}</option>
        </select>
      </label>
      <label className="goal-filter-field">
        <span>{goalsContent.toolbar.statusLabel}</span>
        <select value={status} onChange={(event) => onStatusChange(event.target.value as GoalStatusFilter)}>
          <option value="all">{goalsContent.toolbar.allStatuses}</option>
          <option value="active">Ativas</option>
          <option value="paused">Pausadas</option>
          <option value="completed">Concluídas</option>
        </select>
      </label>
      <button className="clear-filters-button" type="button" onClick={onClear}>
        <CloseIcon />
        {goalsContent.toolbar.clear}
      </button>
    </section>
  );
}
