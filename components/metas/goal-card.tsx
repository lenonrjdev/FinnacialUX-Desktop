import { GoalIcon } from "@/components/metas/goal-icon";
import { MoreIcon, PlusIcon } from "@/components/shared/icons";
import { goalsContent } from "@/content/metas";
import { formatCurrency, formatPercentage, formatShortDate } from "@/lib/formatters";
import type { GoalRow } from "@/types/metas";

export function GoalCard({
  goal,
  accountName,
  selected,
  onSelect,
  onAddValue,
  onEdit,
  onTogglePause,
  onComplete,
}: {
  goal: GoalRow;
  accountName: string;
  selected: boolean;
  onSelect: () => void;
  onAddValue: () => void;
  onEdit: () => void;
  onTogglePause: () => void;
  onComplete: () => void;
}) {
  const progress = Math.min(goal.progress, 100);
  const isCompleted = goal.status === "completed";

  return (
    <article className={`goal-card ${selected ? "selected" : ""} ${isCompleted ? "completed" : ""}`} onClick={onSelect}>
      <header className="goal-card-header">
        <div className="goal-card-identity">
          <GoalIcon category={goal.category} tone={goal.tone} />
          <div>
            <div className="goal-card-badges">
              <span className={`goal-kind-badge ${goal.kind}`}>
                {goal.kind === "reserve" ? goalsContent.list.reserve : goalsContent.list.goal}
              </span>
              <span className={`goal-priority-badge ${goal.priority}`}>
                {goalsContent.priorities[goal.priority]}
              </span>
            </div>
            <h3>{goal.name}</h3>
          </div>
        </div>
        <button className="goal-menu-button" type="button" aria-label={`${goalsContent.accessibility.goalActions}: ${goal.name}`} onClick={(event) => { event.stopPropagation(); onEdit(); }}>
          <MoreIcon />
        </button>
      </header>

      <p className="goal-card-description">{goal.description}</p>

      <div className="goal-card-value-row">
        <div>
          <span>{goalsContent.list.current}</span>
          <strong>{formatCurrency(goal.currentAmount)}</strong>
        </div>
        <div>
          <span>{goalsContent.list.target}</span>
          <strong>{formatCurrency(goal.targetAmount)}</strong>
        </div>
      </div>

      <div className="goal-progress-block">
        <div className="goal-progress-heading">
          <span className={`goal-status-badge ${goal.computedStatus}`}>{goalsContent.statuses[goal.computedStatus]}</span>
          <strong>{formatPercentage(goal.progress)}</strong>
        </div>
        <div className={`goal-progress-track ${goal.computedStatus}`}>
          <span style={{ width: `${progress}%` }} />
        </div>
      </div>

      <div className="goal-card-details">
        <div>
          <span>{goalsContent.list.remaining}</span>
          <strong>{formatCurrency(goal.remaining)}</strong>
        </div>
        <div>
          <span>{goalsContent.list.monthly}</span>
          <strong>{formatCurrency(goal.monthlyContribution)}</strong>
        </div>
        <div>
          <span>{goalsContent.list.targetDate}</span>
          <strong>{formatShortDate(goal.targetDate)}</strong>
        </div>
        <div>
          <span>{goalsContent.list.account}</span>
          <strong>{accountName}</strong>
        </div>
      </div>

      <footer className="goal-card-footer">
        <button className="goal-add-button" type="button" onClick={(event) => { event.stopPropagation(); onAddValue(); }} disabled={isCompleted}>
          <PlusIcon />
          {goalsContent.list.addValue}
        </button>
        <div>
          {!isCompleted ? (
            <button type="button" onClick={(event) => { event.stopPropagation(); onTogglePause(); }}>
              {goal.status === "paused" ? goalsContent.list.resume : goalsContent.list.pause}
            </button>
          ) : null}
          {!isCompleted ? (
            <button type="button" onClick={(event) => { event.stopPropagation(); onComplete(); }}>
              {goalsContent.list.complete}
            </button>
          ) : null}
        </div>
      </footer>
    </article>
  );
}
