"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { ArrowRightLeftIcon, CloseIcon } from "@/components/shared/icons";
import { accountsContent } from "@/content/contas";
import { formatCurrency } from "@/lib/formatters";
import { getReferenceDate } from "@/lib/reference-date";
import type { AccountTransferInput, FinancialAccount } from "@/types/contas";

type TransferForm = {
  sourceAccountId: string;
  destinationAccountId: string;
  amount: string;
  date: string;
  description: string;
};

function createInitialForm(accounts: FinancialAccount[]): TransferForm {
  return {
    sourceAccountId: accounts[0]?.id ?? "",
    destinationAccountId: accounts[1]?.id ?? accounts[0]?.id ?? "",
    amount: "",
    date: getReferenceDate(),
    description: "",
  };
}

export function TransferDialog({
  open,
  accounts,
  onClose,
  onTransfer,
}: {
  open: boolean;
  accounts: FinancialAccount[];
  onClose: () => void;
  onTransfer: (transfer: AccountTransferInput) => void;
}) {
  const [form, setForm] = useState<TransferForm>(() => createInitialForm(accounts));
  const [error, setError] = useState("");

  const sourceAccount = useMemo(
    () => accounts.find((account) => account.id === form.sourceAccountId),
    [accounts, form.sourceAccountId],
  );

  useEffect(() => {
    if (!open) return;

    setForm((current) => {
      const sourceExists = accounts.some(
        (account) => account.id === current.sourceAccountId,
      );
      const destinationExists = accounts.some(
        (account) => account.id === current.destinationAccountId,
      );

      return sourceExists && destinationExists
        ? current
        : createInitialForm(accounts);
    });

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

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const amount = Number(form.amount.replace(",", "."));

    if (
      !form.sourceAccountId ||
      !form.destinationAccountId ||
      !form.date ||
      !form.description.trim()
    ) {
      setError(accountsContent.validation.required);
      return;
    }

    if (!Number.isFinite(amount) || amount <= 0) {
      setError(accountsContent.validation.positiveAmount);
      return;
    }

    if (form.sourceAccountId === form.destinationAccountId) {
      setError(accountsContent.validation.differentAccounts);
      return;
    }

    if (!sourceAccount || amount > sourceAccount.balance) {
      setError(accountsContent.validation.insufficientBalance);
      return;
    }

    onTransfer({
      sourceAccountId: form.sourceAccountId,
      destinationAccountId: form.destinationAccountId,
      amount,
      date: form.date,
      description: form.description.trim(),
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
        className="transaction-dialog account-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="account-transfer-title"
      >
        <header className="transaction-dialog-header">
          <div>
            <span className="page-eyebrow">
              {accountsContent.transferDialog.eyebrow}
            </span>
            <h2 id="account-transfer-title">
              {accountsContent.transferDialog.title}
            </h2>
            <p>{accountsContent.transferDialog.description}</p>
          </div>
          <button
            className="dialog-close-button"
            type="button"
            onClick={onClose}
            aria-label={accountsContent.transferDialog.closeAriaLabel}
          >
            <CloseIcon />
          </button>
        </header>

        <form className="transaction-form" onSubmit={submit}>
          <div className="account-transfer-route" aria-hidden="true">
            <span>{sourceAccount?.name ?? "—"}</span>
            <i>
              <ArrowRightLeftIcon />
            </i>
            <span>
              {accounts.find((account) => account.id === form.destinationAccountId)
                ?.name ?? "—"}
            </span>
          </div>

          <div className="transaction-form-grid">
            <label className="form-field">
              <span>{accountsContent.transferDialog.fields.source}</span>
              <select
                value={form.sourceAccountId}
                onChange={(event) => {
                  setForm({ ...form, sourceAccountId: event.target.value });
                  setError("");
                }}
              >
                {accounts.map((account) => (
                  <option value={account.id} key={account.id}>
                    {account.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="form-field">
              <span>{accountsContent.transferDialog.fields.destination}</span>
              <select
                value={form.destinationAccountId}
                onChange={(event) => {
                  setForm({ ...form, destinationAccountId: event.target.value });
                  setError("");
                }}
              >
                {accounts.map((account) => (
                  <option value={account.id} key={account.id}>
                    {account.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="form-field">
              <span>{accountsContent.transferDialog.fields.amount}</span>
              <div className="currency-input">
                <b>R$</b>
                <input
                  inputMode="decimal"
                  value={form.amount}
                  onChange={(event) => {
                    setForm({ ...form, amount: event.target.value });
                    setError("");
                  }}
                  placeholder="0,00"
                />
              </div>
            </label>

            <label className="form-field">
              <span>{accountsContent.transferDialog.fields.date}</span>
              <input
                type="date"
                value={form.date}
                onChange={(event) => setForm({ ...form, date: event.target.value })}
              />
            </label>

            <label className="form-field form-field-wide">
              <span>{accountsContent.transferDialog.fields.description}</span>
              <input
                value={form.description}
                onChange={(event) =>
                  setForm({ ...form, description: event.target.value })
                }
                placeholder={
                  accountsContent.transferDialog.fields.descriptionPlaceholder
                }
              />
            </label>
          </div>

          <div className="account-source-balance">
            <span>{accountsContent.transferDialog.sourceBalance}</span>
            <strong>{formatCurrency(sourceAccount?.balance ?? 0)}</strong>
          </div>

          {error && <p className="transaction-form-error">{error}</p>}

          <footer className="transaction-dialog-footer">
            <button
              className="secondary-action-button"
              type="button"
              onClick={onClose}
            >
              {accountsContent.transferDialog.cancel}
            </button>
            <button className="primary-action-button" type="submit">
              {accountsContent.transferDialog.submit}
            </button>
          </footer>
        </form>
      </section>
    </div>
  );
}
