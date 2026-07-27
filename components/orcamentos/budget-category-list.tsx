import { CategoryIcon } from "@/components/orcamentos/category-icon";
import { MoreIcon } from "@/components/shared/icons";
import { budgetsContent } from "@/content/orcamentos";
import { formatCurrency, formatPercentage } from "@/lib/formatters";
import type { BudgetRow } from "@/types/orcamentos";

export function BudgetCategoryList({ rows, onEdit }: { rows: BudgetRow[]; onEdit: (row: BudgetRow) => void }) {
  return (
    <section className="budget-list-card">
      <header className="budget-list-header">
        <div>
          <span className="section-eyebrow">{budgetsContent.list.eyebrow}</span>
          <h2>{budgetsContent.list.title}</h2>
        </div>
        <span>{rows.length} {budgetsContent.list.count}</span>
      </header>

      {rows.length ? (
        <div className="budget-category-rows">
          {rows.map((row) => {
            const progress = Math.min(row.usage, 100);
            return (
              <article className="budget-category-row" key={row.id}>
                <div className="budget-category-main">
                  <CategoryIcon categoryId={row.category.id} tone={row.category.tone} />
                  <div>
                    <strong>{row.category.name}</strong>
                    <span>{row.category.description}</span>
                  </div>
                </div>
                <div className="budget-category-values">
                  <div>
                    <span>{budgetsContent.list.planned}</span>
                    <strong>{formatCurrency(row.limit)}</strong>
                  </div>
                  <div>
                    <span>{budgetsContent.list.spent}</span>
                    <strong>{formatCurrency(row.spent)}</strong>
                  </div>
                  <div className={row.available < 0 ? "negative" : ""}>
                    <span>{budgetsContent.list.available}</span>
                    <strong>{formatCurrency(row.available)}</strong>
                  </div>
                </div>
                <div className="budget-progress-area">
                  <div className="budget-progress-heading">
                    <span className={`budget-status-badge ${row.status}`}>{budgetsContent.status[row.status]}</span>
                    <strong>{formatPercentage(row.usage)}</strong>
                  </div>
                  <div className={`budget-progress-track ${row.status}`}>
                    <span style={{ width: `${progress}%` }} />
                  </div>
                </div>
                <button className="budget-row-action" type="button" onClick={() => onEdit(row)} aria-label={`${budgetsContent.list.edit}: ${row.category.name}`}>
                  <MoreIcon />
                </button>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="budget-empty-state">
          <span className="transactions-empty-icon" aria-hidden="true"><i /><i /><i /></span>
          <strong>{budgetsContent.list.emptyTitle}</strong>
          <p>{budgetsContent.list.emptyDescription}</p>
        </div>
      )}
    </section>
  );
}
