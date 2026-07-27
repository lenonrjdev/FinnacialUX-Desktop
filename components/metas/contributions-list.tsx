import { ArrowDownIcon, ArrowUpIcon } from "@/components/shared/icons";
import { goalsContent } from "@/content/metas";
import { formatCurrency, formatShortDate } from "@/lib/formatters";
import type { GoalContribution, GoalRow } from "@/types/metas";

export function ContributionsList({
  contributions,
  goals,
  accountNames,
}: {
  contributions: GoalContribution[];
  goals: GoalRow[];
  accountNames: Record<string, string>;
}) {
  const goalNames = Object.fromEntries(goals.map((goal) => [goal.id, goal.name]));

  return (
    <section className="goal-movements-panel">
      <header className="goal-movements-header">
        <div>
          <span className="section-eyebrow">{goalsContent.movements.eyebrow}</span>
          <h2>{goalsContent.movements.title}</h2>
          <p>{goalsContent.movements.description}</p>
        </div>
        <span>{contributions.length} registros</span>
      </header>

      {contributions.length ? (
        <div className="goal-movement-list">
          {contributions.map((movement) => (
            <article className="goal-movement-row" key={movement.id}>
              <span className={`goal-movement-icon ${movement.type}`}>
                {movement.type === "deposit" ? <ArrowDownIcon /> : <ArrowUpIcon />}
              </span>
              <div className="goal-movement-main">
                <strong>{goalNames[movement.goalId] ?? "Meta removida"}</strong>
                <span>{movement.note}</span>
              </div>
              <div>
                <span>{goalsContent.movements.date}</span>
                <strong>{formatShortDate(movement.date)}</strong>
              </div>
              <div>
                <span>{goalsContent.movements.account}</span>
                <strong>{accountNames[movement.accountId] ?? "—"}</strong>
              </div>
              <div className={`goal-movement-amount ${movement.type}`}>
                <span>{movement.type === "deposit" ? goalsContent.movements.deposit : goalsContent.movements.withdrawal}</span>
                <strong>{movement.type === "deposit" ? "+ " : "- "}{formatCurrency(movement.amount)}</strong>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="budget-empty-state goals-empty-state">
          <span className="transactions-empty-icon" aria-hidden="true"><i /><i /><i /></span>
          <strong>{goalsContent.movements.emptyTitle}</strong>
          <p>{goalsContent.movements.emptyDescription}</p>
        </div>
      )}
    </section>
  );
}
