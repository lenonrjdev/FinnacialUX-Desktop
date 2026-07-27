"use client";

import { useState } from "react";
import { CloseIcon } from "@/components/shared/icons";
import { receivablesContent } from "@/content/recebimentos";
import { getReferenceDate } from "@/lib/reference-date";
import type { FinancialAccount } from "@/types/contas";
import type {
  NewReceivableInput,
  ReceivableRecurrence,
} from "@/types/recebimentos";

type NewReceivableDialogProps = {
  accounts: FinancialAccount[];
  onClose: () => void;
  onSubmit: (input: NewReceivableInput) => void;
};

function parseAmount(value: string): number {
  return Number(value.replace(/\./g, "").replace(",", "."));
}

export function NewReceivableDialog({ accounts, onClose, onSubmit }: NewReceivableDialogProps) {
  const [form, setForm] = useState({
    description: "",
    source: "",
    payer: "",
    category: receivablesContent.categories[0] as string,
    amount: "",
    expectedDate: getReferenceDate(),
    accountId: accounts[0]?.id ?? "",
    recurrence: "none" as ReceivableRecurrence,
    notes: "",
  });
  const [error, setError] = useState("");

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const amount = parseAmount(form.amount);

    if (!form.description.trim() || !form.source.trim() || !form.expectedDate || !form.accountId) {
      setError(receivablesContent.validation.required);
      return;
    }

    if (!Number.isFinite(amount) || amount <= 0) {
      setError(receivablesContent.validation.positiveAmount);
      return;
    }

    onSubmit({
      description: form.description.trim(),
      source: form.source.trim(),
      payer: form.payer.trim() || undefined,
      category: form.category,
      amount,
      expectedDate: form.expectedDate,
      accountId: form.accountId,
      recurrence: form.recurrence,
      notes: form.notes.trim() || undefined,
    });
    onClose();
  }

  return (
    <div className="transaction-dialog-backdrop" role="presentation" onMouseDown={onClose}>
      <section className="transaction-dialog commitment-dialog" role="dialog" aria-modal="true" aria-labelledby="new-receivable-title" onMouseDown={(event) => event.stopPropagation()}>
        <header className="transaction-dialog-header">
          <div>
            <span className="section-eyebrow">{receivablesContent.newDialog.eyebrow}</span>
            <h2 id="new-receivable-title">{receivablesContent.newDialog.title}</h2>
            <p>{receivablesContent.newDialog.description}</p>
          </div>
          <button className="dialog-close-button" type="button" onClick={onClose} aria-label={receivablesContent.newDialog.closeAriaLabel}><CloseIcon /></button>
        </header>

        <form className="transaction-form" onSubmit={submit}>
          <div className="transaction-form-grid">
            <label className="form-field form-field-wide">
              <span>{receivablesContent.newDialog.fields.description}</span>
              <input value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} placeholder={receivablesContent.newDialog.fields.descriptionPlaceholder} />
            </label>

            <label className="form-field">
              <span>{receivablesContent.newDialog.fields.source}</span>
              <input value={form.source} onChange={(event) => setForm({ ...form, source: event.target.value })} placeholder={receivablesContent.newDialog.fields.sourcePlaceholder} />
            </label>

            <label className="form-field">
              <span>{receivablesContent.newDialog.fields.payer}</span>
              <input value={form.payer} onChange={(event) => setForm({ ...form, payer: event.target.value })} placeholder={receivablesContent.newDialog.fields.payerPlaceholder} />
            </label>

            <label className="form-field">
              <span>{receivablesContent.newDialog.fields.category}</span>
              <select value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })}>
                {receivablesContent.categories.map((category) => <option value={category} key={category}>{category}</option>)}
              </select>
            </label>

            <label className="form-field">
              <span>{receivablesContent.newDialog.fields.amount}</span>
              <div className="currency-input"><b>R$</b><input inputMode="decimal" value={form.amount} onChange={(event) => setForm({ ...form, amount: event.target.value })} placeholder="0,00" /></div>
            </label>

            <label className="form-field">
              <span>{receivablesContent.newDialog.fields.expectedDate}</span>
              <input type="date" value={form.expectedDate} onChange={(event) => setForm({ ...form, expectedDate: event.target.value })} />
            </label>

            <label className="form-field">
              <span>{receivablesContent.newDialog.fields.account}</span>
              <select value={form.accountId} onChange={(event) => setForm({ ...form, accountId: event.target.value })}>
                {accounts.map((account) => <option value={account.id} key={account.id}>{account.name}</option>)}
              </select>
            </label>

            <label className="form-field form-field-wide">
              <span>{receivablesContent.newDialog.fields.recurrence}</span>
              <select value={form.recurrence} onChange={(event) => setForm({ ...form, recurrence: event.target.value as ReceivableRecurrence })}>
                {Object.entries(receivablesContent.recurrences).map(([value, label]) => <option value={value} key={value}>{label}</option>)}
              </select>
            </label>

            <label className="form-field form-field-wide">
              <span>{receivablesContent.newDialog.fields.notes}</span>
              <textarea value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} placeholder={receivablesContent.newDialog.fields.notesPlaceholder} />
            </label>
          </div>

          {error ? <p className="transaction-form-error">{error}</p> : null}

          <footer className="transaction-dialog-footer">
            <button className="secondary-action-button" type="button" onClick={onClose}>{receivablesContent.newDialog.cancel}</button>
            <button className="primary-action-button" type="submit">{receivablesContent.newDialog.submit}</button>
          </footer>
        </form>
      </section>
    </div>
  );
}
