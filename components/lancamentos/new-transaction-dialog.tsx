"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  ArrowRightLeftIcon,
  CloseIcon,
  IncomeIcon,
  TransactionsIcon,
} from "@/components/shared/icons";
import { transactionsContent } from "@/content/lancamentos";
import { getReferenceDate } from "@/lib/reference-date";
import type {
  NewTransactionInput,
  TransactionStatus,
  TransactionType,
} from "@/types/lancamentos";

const typeIcons = {
  income: IncomeIcon,
  expense: TransactionsIcon,
  transfer: ArrowRightLeftIcon,
};

type TransactionFormState = {
  type: TransactionType;
  description: string;
  amount: string;
  date: string;
  category: string;
  account: string;
  destinationAccount: string;
  paymentMethod: string;
  status: TransactionStatus;
  note: string;
};

function createInitialForm(accounts: string[]): TransactionFormState {
  return {
    type: "expense",
    description: "",
    amount: "",
    date: getReferenceDate(),
    category: transactionsContent.options.categories.expense[0],
    account: accounts[0] ?? "",
    destinationAccount: accounts[1] ?? "",
    paymentMethod: transactionsContent.options.paymentMethods[0],
    status: "completed",
    note: "",
  };
}

export function NewTransactionDialog({
  open,
  accounts,
  onClose,
  onCreate,
}: {
  open: boolean;
  accounts: string[];
  onClose: () => void;
  onCreate: (transaction: NewTransactionInput) => void;
}) {
  const [form, setForm] = useState<TransactionFormState>(() => createInitialForm(accounts));
  const [error, setError] = useState("");

  const categoryOptions = useMemo(
    () => transactionsContent.options.categories[form.type],
    [form.type],
  );

  useEffect(() => {
    if (!open) return;

    setForm((current) => ({
      ...current,
      date: current.date || getReferenceDate(),
      account: accounts.includes(current.account) ? current.account : accounts[0] ?? "",
      destinationAccount: accounts.includes(current.destinationAccount)
        ? current.destinationAccount
        : accounts[1] ?? accounts[0] ?? "",
    }));

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", closeOnEscape);

    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [accounts, onClose, open]);

  if (!open) return null;

  function setType(type: TransactionType) {
    setForm((current) => ({
      ...current,
      type,
      category: transactionsContent.options.categories[type][0],
      paymentMethod:
        type === "transfer" ? "Transferência bancária" : current.paymentMethod,
    }));
    setError("");
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const amount = Number(form.amount.replace(",", "."));

    if (accounts.length === 0) {
      setError("Cadastre uma conta antes de criar um lançamento.");
      return;
    }

    if (!form.description.trim() || !form.date || !form.category || !form.account) {
      setError(transactionsContent.validation.required);
      return;
    }

    if (!Number.isFinite(amount) || amount <= 0) {
      setError(transactionsContent.validation.positiveAmount);
      return;
    }

    if (form.type === "transfer" && form.account === form.destinationAccount) {
      setError(transactionsContent.validation.differentAccounts);
      return;
    }

    onCreate({
      description: form.description.trim(),
      amount,
      date: form.date,
      category: form.category,
      account: form.account,
      destinationAccount:
        form.type === "transfer" ? form.destinationAccount : undefined,
      paymentMethod: form.paymentMethod,
      type: form.type,
      status: form.status,
      note: form.note.trim() || undefined,
    });

    setForm(createInitialForm(accounts));
    setError("");
    onClose();
  }

  return (
    <div
      className="transaction-dialog-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        className="transaction-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="new-transaction-title"
      >
        <header className="transaction-dialog-header">
          <div>
            <span className="page-eyebrow">{transactionsContent.dialog.eyebrow}</span>
            <h2 id="new-transaction-title">{transactionsContent.dialog.title}</h2>
            <p>{transactionsContent.dialog.description}</p>
          </div>
          <button
            className="dialog-close-button"
            type="button"
            onClick={onClose}
            aria-label={transactionsContent.dialog.closeAriaLabel}
          >
            <CloseIcon />
          </button>
        </header>

        <form className="transaction-form" onSubmit={submit}>
          <fieldset className="transaction-type-selector">
            <legend>{transactionsContent.dialog.typeLegend}</legend>
            <div>
              {(Object.keys(transactionsContent.types) as TransactionType[]).map(
                (type) => {
                  const Icon = typeIcons[type];
                  return (
                    <button
                      className={form.type === type ? "active" : ""}
                      type="button"
                      onClick={() => setType(type)}
                      key={type}
                    >
                      <Icon />
                      {transactionsContent.types[type]}
                    </button>
                  );
                },
              )}
            </div>
          </fieldset>

          <div className="transaction-form-grid">
            <label className="form-field form-field-wide">
              <span>{transactionsContent.dialog.fields.description}</span>
              <input
                value={form.description}
                onChange={(event) =>
                  setForm({ ...form, description: event.target.value })
                }
                placeholder={transactionsContent.dialog.fields.descriptionPlaceholder}
                autoFocus
              />
            </label>

            <label className="form-field">
              <span>{transactionsContent.dialog.fields.amount}</span>
              <div className="currency-input">
                <b>R$</b>
                <input
                  inputMode="decimal"
                  value={form.amount}
                  onChange={(event) =>
                    setForm({ ...form, amount: event.target.value })
                  }
                  placeholder={transactionsContent.dialog.fields.amountPlaceholder}
                />
              </div>
            </label>

            <label className="form-field">
              <span>{transactionsContent.dialog.fields.date}</span>
              <input
                type="date"
                value={form.date}
                onChange={(event) => setForm({ ...form, date: event.target.value })}
              />
            </label>

            <label className="form-field">
              <span>{transactionsContent.dialog.fields.category}</span>
              <select
                value={form.category}
                onChange={(event) =>
                  setForm({ ...form, category: event.target.value })
                }
              >
                {categoryOptions.map((category) => (
                  <option value={category} key={category}>
                    {category}
                  </option>
                ))}
              </select>
            </label>

            <label className="form-field">
              <span>{transactionsContent.dialog.fields.account}</span>
              <select
                value={form.account}
                onChange={(event) => setForm({ ...form, account: event.target.value })}
              >
                {accounts.length === 0 ? <option value="">Cadastre uma conta primeiro</option> : null}
                {accounts.map((account) => (
                  <option value={account} key={account}>
                    {account}
                  </option>
                ))}
              </select>
            </label>

            {form.type === "transfer" && (
              <label className="form-field">
                <span>{transactionsContent.dialog.fields.destinationAccount}</span>
                <select
                  value={form.destinationAccount}
                  onChange={(event) =>
                    setForm({ ...form, destinationAccount: event.target.value })
                  }
                >
                  {accounts.length === 0 ? <option value="">Cadastre uma conta primeiro</option> : null}
                  {accounts.map((account) => (
                    <option value={account} key={account}>
                      {account}
                    </option>
                  ))}
                </select>
              </label>
            )}

            <label className="form-field">
              <span>{transactionsContent.dialog.fields.paymentMethod}</span>
              <select
                value={form.paymentMethod}
                onChange={(event) =>
                  setForm({ ...form, paymentMethod: event.target.value })
                }
              >
                {transactionsContent.options.paymentMethods.map((method) => (
                  <option value={method} key={method}>
                    {method}
                  </option>
                ))}
              </select>
            </label>

            <label className="form-field">
              <span>{transactionsContent.dialog.fields.status}</span>
              <select
                value={form.status}
                onChange={(event) =>
                  setForm({
                    ...form,
                    status: event.target.value as TransactionStatus,
                  })
                }
              >
                {Object.entries(transactionsContent.statuses).map(([value, label]) => (
                  <option value={value} key={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>

            <label className="form-field form-field-wide">
              <span>{transactionsContent.dialog.fields.note}</span>
              <textarea
                value={form.note}
                onChange={(event) => setForm({ ...form, note: event.target.value })}
                placeholder={transactionsContent.dialog.fields.notePlaceholder}
                rows={3}
              />
            </label>
          </div>

          {error && <p className="transaction-form-error">{error}</p>}

          <footer className="transaction-dialog-footer">
            <button className="secondary-action-button" type="button" onClick={onClose}>
              {transactionsContent.dialog.cancel}
            </button>
            <button className="primary-action-button" type="submit">
              {transactionsContent.dialog.submit}
            </button>
          </footer>
        </form>
      </section>
    </div>
  );
}
