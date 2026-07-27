import { PlusIcon, TagIcon } from "@/components/shared/icons";
import { budgetsContent } from "@/content/orcamentos";
import type { BudgetView } from "@/types/orcamentos";

export function BudgetsHeading({
  view,
  onNewBudget,
  onNewCategory,
}: {
  view: BudgetView;
  onNewBudget: () => void;
  onNewCategory: () => void;
}) {
  return (
    <header className="financial-management-heading budgets-heading">
      <div>
        <span className="section-eyebrow">{budgetsContent.heading.eyebrow}</span>
        <h1>{budgetsContent.heading.title}</h1>
        <p>{budgetsContent.heading.description}</p>
      </div>
      <div className="transactions-heading-actions">
        {view === "categories" ? (
          <button className="secondary-action-button" type="button" onClick={onNewCategory}>
            <TagIcon />
            {budgetsContent.heading.newCategory}
          </button>
        ) : null}
        <button className="primary-action-button" type="button" onClick={onNewBudget}>
          <PlusIcon />
          {budgetsContent.heading.newBudget}
        </button>
      </div>
    </header>
  );
}
