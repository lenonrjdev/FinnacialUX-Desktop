import { PlusIcon, SavingsIcon } from "@/components/shared/icons";
import { goalsContent } from "@/content/metas";

export function GoalsHeading({
  onNewGoal,
  onNewContribution,
}: {
  onNewGoal: () => void;
  onNewContribution: () => void;
}) {
  return (
    <header className="financial-management-heading goals-heading">
      <div>
        <span className="section-eyebrow">{goalsContent.heading.eyebrow}</span>
        <h1>{goalsContent.heading.title}</h1>
        <p>{goalsContent.heading.description}</p>
      </div>
      <div className="transactions-heading-actions">
        <button className="secondary-action-button" type="button" onClick={onNewContribution}>
          <SavingsIcon />
          {goalsContent.heading.newContribution}
        </button>
        <button className="primary-action-button" type="button" onClick={onNewGoal}>
          <PlusIcon />
          {goalsContent.heading.newGoal}
        </button>
      </div>
    </header>
  );
}
