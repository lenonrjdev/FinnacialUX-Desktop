"use client";

import { useState } from "react";
import { CloseIcon } from "@/components/shared/icons";
import { payablesContent } from "@/content/contas-a-pagar";
import { financialIntelligenceContent } from "@/content/financial-intelligence";
import { getReferenceDate } from "@/lib/reference-date";
import type { FinancialAccount } from "@/types/contas";
import type {
  NewPayableInput,
  PayableRecurrence,
  PayableValueType,
} from "@/types/contas-a-pagar";

type NewPayableDialogProps = {
  accounts: FinancialAccount[];
  onClose: () => void;
  onSubmit: (input: NewPayableInput) => void;
};

function parseAmount(value: string): number {
  const normalized = value.replace(/\./g, "").replace(",", ".");
  return Number(normalized);
}

export function NewPayableDialog({ accounts, onClose, onSubmit }: NewPayableDialogProps) {
  const [form, setForm] = useState({
    description: "",
    category: payablesContent.categories[0] as string,
    amount: "",
    dueDate: getReferenceDate(),
    accountId: accounts[0]?.id ?? "",
    recurrence: "none" as PayableRecurrence,
    valueType: "fixed" as PayableValueType,
    notes: "",
  });
  const [error, setError] = useState("");

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const amount = parseAmount(form.amount);

    if (!form.description.trim() || !form.dueDate || !form.accountId) {
      setError(payablesContent.validation.required);
      return;
    }

    if (!Number.isFinite(amount) || amount <= 0) {
      setError(payablesContent.validation.positiveAmount);
      return;
    }

    onSubmit({
      description: form.description.trim(),
      category: form.category,
      amount,
      dueDate: form.dueDate,
      accountId: form.accountId,
      recurrence: form.recurrence,
      valueType: form.valueType,
      notes: form.notes.trim() || undefined,
    });
    onClose();
  }

  return (
    <div className="transaction-dialog-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className="transaction-dialog commitment-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="new-payable-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="transaction-dialog-header">
          <div>
            <span className="section-eyebrow">{payablesContent.newDialog.eyebrow}</span>
            <h2 id="new-payable-title">{payablesContent.newDialog.title}</h2>
            <p>{payablesContent.newDialog.description}</p>
          </div>
          <button className="dialog-close-button" type="button" onClick={onClose} aria-label={payablesContent.newDialog.closeAriaLabel}>
            <CloseIcon />
          </button>
        </header>

        <form className="transaction-form" onSubmit={submit}>
          <div className="transaction-form-grid">
            <label className="form-field form-field-wide">
              <span>{payablesContent.newDialog.fields.description}</span>
              <input
                value={form.description}
                onChange={(event) => setForm({ ...form, description: event.target.value })}
                placeholder={payablesContent.newDialog.fields.descriptionPlaceholder}
              />
            </label>

            <label className="form-field">
              <span>{payablesContent.newDialog.fields.category}</span>
              <select value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })}>
                {payablesContent.categories.map((category) => <option value={category} key={category}>{category}</option>)}
              </select>
            </label>

            <label className="form-field">
              <span>{payablesContent.newDialog.fields.amount}</span>
              <div className="currency-input">
                <b>R$</b>
                <input inputMode="decimal" value={form.amount} onChange={(event) => setForm({ ...form, amount: event.target.value })} placeholder="0,00" />
              </div>
            </label>

            <label className="form-field">
              <span>{payablesContent.newDialog.fields.dueDate}</span>
              <input type="date" value={form.dueDate} onChange={(event) => setForm({ ...form, dueDate: event.target.value })} />
            </label>

            <label className="form-field">
              <span>{payablesContent.newDialog.fields.account}</span>
              <select value={form.accountId} onChange={(event) => setForm({ ...form, accountId: event.target.value })}>
                {accounts.map((account) => <option value={account.id} key={account.id}>{account.name}</option>)}
              </select>
            </label>

            <label className="form-field">
              <span>{payablesContent.newDialog.fields.recurrence}</span>
              <select value={form.recurrence} onChange={(event) => setForm({ ...form, recurrence: event.target.value as PayableRecurrence })}>
                {Object.entries(payablesContent.recurrences).map(([value, label]) => <option value={value} key={value}>{label}</option>)}
              </select>
              <small className="form-field-helper">{financialIntelligenceContent.recurring.explanation}</small>
            </label>

            <label className="form-field">
              <span>{payablesContent.newDialog.fields.valueType}</span>
              <select value={form.valueType} onChange={(event) => setForm({ ...form, valueType: event.target.value as PayableValueType })}>
                {Object.entries(payablesContent.valueTypes).map(([value, label]) => <option value={value} key={value}>{label}</option>)}
              </select>
            </label>

            <label className="form-field form-field-wide">
              <span>{payablesContent.newDialog.fields.notes}</span>
              <textarea value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} placeholder={payablesContent.newDialog.fields.notesPlaceholder} />
            </label>
          </div>

          {error ? <p className="transaction-form-error">{error}</p> : null}

          <footer className="transaction-dialog-footer">
            <button className="secondary-action-button" type="button" onClick={onClose}>{payablesContent.newDialog.cancel}</button>
            <button className="primary-action-button" type="submit">{payablesContent.newDialog.submit}</button>
          </footer>
        </form>
      </section>
    </div>
  );
}
