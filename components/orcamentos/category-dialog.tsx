"use client";

import { useState } from "react";
import { CloseIcon } from "@/components/shared/icons";
import { budgetsContent } from "@/content/orcamentos";
import type { CategoryFormInput, CategoryTone, CategoryType } from "@/types/orcamentos";

const tones: CategoryTone[] = ["graphite", "sage", "sand", "violet", "rose", "blue"];

export function CategoryDialog({
  existingNames,
  onClose,
  onSubmit,
}: {
  existingNames: string[];
  onClose: () => void;
  onSubmit: (input: CategoryFormInput) => void;
}) {
  const [name, setName] = useState("");
  const [type, setType] = useState<CategoryType>("expense");
  const [description, setDescription] = useState("");
  const [tone, setTone] = useState<CategoryTone>("graphite");
  const [error, setError] = useState("");

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedName = name.trim().toLocaleLowerCase("pt-BR");

    if (!normalizedName || !description.trim()) {
      setError(budgetsContent.categoryDialog.required);
      return;
    }

    if (existingNames.some((item) => item.toLocaleLowerCase("pt-BR") === normalizedName)) {
      setError(budgetsContent.categoryDialog.duplicate);
      return;
    }

    onSubmit({ name: name.trim(), type, description: description.trim(), tone });
  }

  return (
    <div className="transaction-dialog-backdrop" role="presentation" onMouseDown={onClose}>
      <section className="transaction-dialog category-dialog" role="dialog" aria-modal="true" aria-labelledby="category-dialog-title" onMouseDown={(event) => event.stopPropagation()}>
        <header className="transaction-dialog-header">
          <div>
            <span className="section-eyebrow">{budgetsContent.categoryDialog.eyebrow}</span>
            <h2 id="category-dialog-title">{budgetsContent.categoryDialog.title}</h2>
            <p>{budgetsContent.categoryDialog.description}</p>
          </div>
          <button className="dialog-close-button" type="button" onClick={onClose} aria-label={budgetsContent.accessibility.closeDialog}><CloseIcon /></button>
        </header>
        <form className="transaction-form" onSubmit={submit}>
          <div className="category-dialog-grid">
            <label className="form-field">
              <span>{budgetsContent.categoryDialog.name}</span>
              <input value={name} onChange={(event) => setName(event.target.value)} placeholder={budgetsContent.categoryDialog.namePlaceholder} />
            </label>
            <label className="form-field">
              <span>{budgetsContent.categoryDialog.type}</span>
              <select value={type} onChange={(event) => setType(event.target.value as CategoryType)}>
                <option value="expense">{budgetsContent.categoryDialog.expense}</option>
                <option value="income">{budgetsContent.categoryDialog.income}</option>
              </select>
            </label>
            <label className="form-field category-description-field">
              <span>{budgetsContent.categoryDialog.descriptionLabel}</span>
              <textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={3} placeholder={budgetsContent.categoryDialog.descriptionPlaceholder} />
            </label>
            <fieldset className="category-tone-selector">
              <legend>{budgetsContent.categoryDialog.tone}</legend>
              <div>
                {tones.map((item) => (
                  <button key={item} type="button" className={`${item} ${tone === item ? "active" : ""}`} onClick={() => setTone(item)} aria-label={`${budgetsContent.accessibility.tone}: ${item}`}>
                    <span />
                  </button>
                ))}
              </div>
            </fieldset>
          </div>
          {error ? <p className="form-error-message">{error}</p> : null}
          <footer className="transaction-dialog-footer">
            <button type="button" className="secondary-action-button" onClick={onClose}>{budgetsContent.categoryDialog.cancel}</button>
            <button type="submit" className="primary-action-button">{budgetsContent.categoryDialog.create}</button>
          </footer>
        </form>
      </section>
    </div>
  );
}
