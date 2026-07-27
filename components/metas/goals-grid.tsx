import { GoalCard } from "@/components/metas/goal-card";
import { goalsContent } from "@/content/metas";
import type { GoalRow } from "@/types/metas";

export function GoalsGrid({
  goals,
  accountNames,
  selectedId,
  onSelect,
  onAddValue,
  onEdit,
  onTogglePause,
  onComplete,
}: {
  goals: GoalRow[];
  accountNames: Record<string, string>;
  selectedId: string;
  onSelect: (goal: GoalRow) => void;
  onAddValue: (goal: GoalRow) => void;
  onEdit: (goal: GoalRow) => void;
  onTogglePause: (goal: GoalRow) => void;
  onComplete: (goal: GoalRow) => void;
}) {
  return (
    <section className="goals-list-panel">
      <header className="goals-list-header">
        <div>
          <span className="section-eyebrow">{goalsContent.list.eyebrow}</span>
          <h2>{goalsContent.list.title}</h2>
        </div>
        <span>{goals.length} {goalsContent.list.count}</span>
      </header>

      {goals.length ? (
        <div className="goals-card-grid">
          {goals.map((goal) => (
            <GoalCard
              key={goal.id}
              goal={goal}
              accountName={accountNames[goal.accountId] ?? "—"}
              selected={selectedId === goal.id}
              onSelect={() => onSelect(goal)}
              onAddValue={() => onAddValue(goal)}
              onEdit={() => onEdit(goal)}
              onTogglePause={() => onTogglePause(goal)}
              onComplete={() => onComplete(goal)}
            />
          ))}
        </div>
      ) : (
        <div className="budget-empty-state goals-empty-state">
          <span className="transactions-empty-icon" aria-hidden="true"><i /><i /><i /></span>
          <strong>{goalsContent.list.emptyTitle}</strong>
          <p>{goalsContent.list.emptyDescription}</p>
        </div>
      )}
    </section>
  );
}
