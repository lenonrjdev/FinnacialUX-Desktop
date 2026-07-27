import { CategoryIcon } from "@/components/orcamentos/category-icon";
import { PlusIcon } from "@/components/shared/icons";
import { budgetsContent } from "@/content/orcamentos";
import type { FinancialCategory } from "@/types/orcamentos";

function CategoryGroup({
  title,
  countLabel,
  categories,
  onToggle,
}: {
  title: string;
  countLabel: string;
  categories: FinancialCategory[];
  onToggle: (categoryId: string) => void;
}) {
  return (
    <section className="category-group-card">
      <header>
        <div>
          <h2>{title}</h2>
          <span>{categories.length} {countLabel}</span>
        </div>
      </header>
      <div className="category-manager-grid">
        {categories.map((category) => (
          <article className={`category-manager-card ${category.active ? "" : "inactive"}`} key={category.id}>
            <div className="category-manager-top">
              <CategoryIcon categoryId={category.id} tone={category.tone} />
              <span className={`category-active-badge ${category.active ? "active" : "inactive"}`}>
                {category.active ? budgetsContent.categories.active : budgetsContent.categories.inactive}
              </span>
            </div>
            <strong>{category.name}</strong>
            <p>{category.description}</p>
            <footer>
              <span>{category.isDefault ? budgetsContent.categories.default : budgetsContent.categories.custom}</span>
              <button type="button" onClick={() => onToggle(category.id)}>
                {category.active ? budgetsContent.categories.deactivate : budgetsContent.categories.activate}
              </button>
            </footer>
          </article>
        ))}
      </div>
    </section>
  );
}

export function CategoriesManager({
  categories,
  onNew,
  onToggle,
}: {
  categories: FinancialCategory[];
  onNew: () => void;
  onToggle: (categoryId: string) => void;
}) {
  const expenses = categories.filter((category) => category.type === "expense");
  const incomes = categories.filter((category) => category.type === "income");

  return (
    <section className="categories-manager">
      <header className="categories-manager-heading">
        <div>
          <span className="section-eyebrow">{budgetsContent.categories.eyebrow}</span>
          <h2>{budgetsContent.categories.title}</h2>
          <p>{budgetsContent.categories.description}</p>
        </div>
        <button type="button" className="secondary-action-button" onClick={onNew}>
          <PlusIcon /> {budgetsContent.heading.newCategory}
        </button>
      </header>
      <div className="categories-manager-groups">
        <CategoryGroup title={budgetsContent.categories.expenses} countLabel={budgetsContent.categories.expenseCount} categories={expenses} onToggle={onToggle} />
        <CategoryGroup title={budgetsContent.categories.incomes} countLabel={budgetsContent.categories.incomeCount} categories={incomes} onToggle={onToggle} />
      </div>
    </section>
  );
}
