"use client";

import { useState } from "react";
import { CloseIcon } from "@/components/shared/icons";
import { calendarContent } from "@/content/calendario";
import type { FinancialAccount } from "@/types/contas";
import type {
  CalendarEventRecurrence,
  CalendarEventType,
  NewCalendarEventInput,
} from "@/types/calendario";

type NewCalendarEventDialogProps = {
  accounts: FinancialAccount[];
  initialDate: string;
  onClose: () => void;
  onSubmit: (input: NewCalendarEventInput) => void;
};

function parseAmount(value: string): number {
  return Number(value.replace(/\./g, "").replace(",", "."));
}

export function NewCalendarEventDialog({
  accounts,
  initialDate,
  onClose,
  onSubmit,
}: NewCalendarEventDialogProps) {
  const [form, setForm] = useState({
    title: "",
    type: "expense" as CalendarEventType,
    amount: "",
    date: initialDate,
    category: calendarContent.categories[0] as string,
    accountId: accounts[0]?.id ?? "",
    recurrence: "none" as CalendarEventRecurrence,
    notes: "",
  });
  const [error, setError] = useState("");

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const amount = parseAmount(form.amount);

    if (!form.title.trim() || !form.date || !form.category) {
      setError(calendarContent.validation.required);
      return;
    }

    if (!Number.isFinite(amount) || amount <= 0) {
      setError(calendarContent.validation.positiveAmount);
      return;
    }

    onSubmit({
      title: form.title.trim(),
      type: form.type,
      amount,
      date: form.date,
      category: form.category,
      accountId: form.accountId || undefined,
      recurrence: form.recurrence,
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
        aria-labelledby="new-calendar-event-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="transaction-dialog-header">
          <div>
            <span className="section-eyebrow">{calendarContent.dialog.eyebrow}</span>
            <h2 id="new-calendar-event-title">{calendarContent.dialog.title}</h2>
            <p>{calendarContent.dialog.description}</p>
          </div>
          <button
            className="dialog-close-button"
            type="button"
            onClick={onClose}
            aria-label={calendarContent.dialog.closeAriaLabel}
          >
            <CloseIcon />
          </button>
        </header>

        <form className="transaction-form" onSubmit={submit}>
          <div className="transaction-form-grid">
            <label className="form-field form-field-wide">
              <span>{calendarContent.dialog.fields.title}</span>
              <input
                value={form.title}
                onChange={(event) => setForm({ ...form, title: event.target.value })}
                placeholder={calendarContent.dialog.fields.titlePlaceholder}
              />
            </label>

            <label className="form-field">
              <span>{calendarContent.dialog.fields.type}</span>
              <select
                value={form.type}
                onChange={(event) => setForm({ ...form, type: event.target.value as CalendarEventType })}
              >
                {Object.entries(calendarContent.types).map(([value, label]) => (
                  <option value={value} key={value}>{label}</option>
                ))}
              </select>
            </label>

            <label className="form-field">
              <span>{calendarContent.dialog.fields.category}</span>
              <select
                value={form.category}
                onChange={(event) => setForm({ ...form, category: event.target.value })}
              >
                {calendarContent.categories.map((category) => (
                  <option value={category} key={category}>{category}</option>
                ))}
              </select>
            </label>

            <label className="form-field">
              <span>{calendarContent.dialog.fields.amount}</span>
              <div className="currency-input">
                <b>{calendarContent.dialog.fields.currencyPrefix}</b>
                <input
                  inputMode="decimal"
                  value={form.amount}
                  onChange={(event) => setForm({ ...form, amount: event.target.value })}
                  placeholder={calendarContent.dialog.fields.amountPlaceholder}
                />
              </div>
            </label>

            <label className="form-field">
              <span>{calendarContent.dialog.fields.date}</span>
              <input
                type="date"
                value={form.date}
                onChange={(event) => setForm({ ...form, date: event.target.value })}
              />
            </label>

            <label className="form-field">
              <span>{calendarContent.dialog.fields.account}</span>
              <select
                value={form.accountId}
                onChange={(event) => setForm({ ...form, accountId: event.target.value })}
              >
                <option value="">{calendarContent.dialog.fields.noAccount}</option>
                {accounts.map((account) => (
                  <option value={account.id} key={account.id}>{account.name}</option>
                ))}
              </select>
            </label>

            <label className="form-field">
              <span>{calendarContent.dialog.fields.recurrence}</span>
              <select
                value={form.recurrence}
                onChange={(event) => setForm({ ...form, recurrence: event.target.value as CalendarEventRecurrence })}
              >
                {Object.entries(calendarContent.recurrences).map(([value, label]) => (
                  <option value={value} key={value}>{label}</option>
                ))}
              </select>
            </label>

            <label className="form-field form-field-wide">
              <span>{calendarContent.dialog.fields.notes}</span>
              <textarea
                value={form.notes}
                onChange={(event) => setForm({ ...form, notes: event.target.value })}
                placeholder={calendarContent.dialog.fields.notesPlaceholder}
              />
            </label>
          </div>

          {error ? <p className="transaction-form-error">{error}</p> : null}

          <footer className="transaction-dialog-footer">
            <button className="secondary-action-button" type="button" onClick={onClose}>
              {calendarContent.dialog.cancel}
            </button>
            <button className="primary-action-button" type="submit">
              {calendarContent.dialog.submit}
            </button>
          </footer>
        </form>
      </section>
    </div>
  );
}
