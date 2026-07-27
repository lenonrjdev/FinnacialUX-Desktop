"use client";

import { useMemo, useState } from "react";
import { CloseIcon } from "@/components/shared/icons";
import { budgetsContent } from "@/content/orcamentos";
import type {
  BudgetFormInput,
  BudgetRow,
  FinancialCategory,
} from "@/types/orcamentos";

export function BudgetDialog({
  categories,
  existingCategoryIds,
  editing,
  onClose,
  onSubmit,
}: {
  categories: FinancialCategory[];
  existingCategoryIds: string[];
  editing?: BudgetRow | null;
  onClose: () => void;
  onSubmit: (input: BudgetFormInput) => void;
}) {
  const availableCategories = useMemo(
    () => categories.filter((category) =>
      category.type === "expense"
      && category.active
      && (!existingCategoryIds.includes(category.id) || editing?.categoryId === category.id)),
    [categories, editing?.categoryId, existingCategoryIds],
  );
  const [categoryId, setCategoryId] = useState(editing?.categoryId ?? availableCategories[0]?.id ?? "");
  const [limit, setLimit] = useState(editing ? String(editing.limit) : "");
  const [threshold, setThreshold] = useState(editing ? String(editing.alertThreshold) : "80");
  const [error, setError] = useState("");

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsedLimit = Number(limit);
    const parsedThreshold = Number(threshold);

    if (!categoryId || !limit || !threshold) {
      setError(budgetsContent.budgetDialog.required);
      return;
    }

    if (!Number.isFinite(parsedLimit) || parsedLimit <= 0) {
      setError(budgetsContent.budgetDialog.invalidLimit);
      return;
    }

    onSubmit({
      categoryId,
      limit: parsedLimit,
      alertThreshold: Math.min(100, Math.max(1, parsedThreshold)),
    });
  }

  return (
    <div className="transaction-dialog-backdrop" role="presentation" onMouseDown={onClose}>
      <section className="transaction-dialog budget-dialog" role="dialog" aria-modal="true" aria-labelledby="budget-dialog-title" onMouseDown={(event) => event.stopPropagation()}>
        <header className="transaction-dialog-header">
          <div>
            <span className="section-eyebrow">{budgetsContent.budgetDialog.eyebrow}</span>
            <h2 id="budget-dialog-title">{editing ? budgetsContent.budgetDialog.editTitle : budgetsContent.budgetDialog.createTitle}</h2>
            <p>{budgetsContent.budgetDialog.description}</p>
          </div>
          <button className="dialog-close-button" type="button" onClick={onClose} aria-label={budgetsContent.accessibility.closeDialog}>
            <CloseIcon />
          </button>
        </header>
        <form className="transaction-form" onSubmit={submit}>
          <div className="budget-dialog-grid">
            <label className="form-field budget-dialog-category">
              <span>{budgetsContent.budgetDialog.category}</span>
              <select value={categoryId} onChange={(event) => setCategoryId(event.target.value)} disabled={Boolean(editing)}>
                {availableCategories.length ? availableCategories.map((category) => <option value={category.id} key={category.id}>{category.name}</option>) : <option value="">{budgetsContent.budgetDialog.emptyCategories}</option>}
              </select>
            </label>
            <label className="form-field">
              <span>{budgetsContent.budgetDialog.limit}</span>
              <input type="number" min="0" step="0.01" value={limit} onChange={(event) => setLimit(event.target.value)} placeholder={budgetsContent.budgetDialog.limitPlaceholder} />
            </label>
            <label className="form-field">
              <span>{budgetsContent.budgetDialog.threshold}</span>
              <select value={threshold} onChange={(event) => setThreshold(event.target.value)}>
                <option value="70">70%</option>
                <option value="75">75%</option>
                <option value="80">80%</option>
                <option value="85">85%</option>
                <option value="90">90%</option>
              </select>
              <small>{budgetsContent.budgetDialog.thresholdHint}</small>
            </label>
          </div>
          {error ? <p className="form-error-message">{error}</p> : null}
          <footer className="transaction-dialog-footer">
            <button type="button" className="secondary-action-button" onClick={onClose}>{budgetsContent.budgetDialog.cancel}</button>
            <button type="submit" className="primary-action-button">{editing ? budgetsContent.budgetDialog.save : budgetsContent.budgetDialog.create}</button>
          </footer>
        </form>
      </section>
    </div>
  );
}
