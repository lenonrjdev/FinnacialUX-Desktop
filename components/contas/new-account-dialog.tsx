"use client";

import { FormEvent, useEffect, useState } from "react";
import { CloseIcon } from "@/components/shared/icons";
import { accountsContent } from "@/content/contas";
import type {
  AccountGroup,
  AccountIconName,
  AccountType,
  NewAccountInput,
} from "@/types/contas";

const typeConfiguration: Record<
  AccountType,
  { group: AccountGroup; icon: AccountIconName }
> = {
  checking: { group: "bank", icon: "bank" },
  digital: { group: "bank", icon: "bank" },
  savings: { group: "reserve", icon: "savings" },
  cash: { group: "wallet", icon: "wallet" },
  investment: { group: "reserve", icon: "investment" },
};

type NewAccountForm = {
  name: string;
  institution: string;
  type: AccountType;
  initialBalance: string;
  includeInTotal: boolean;
};

const initialForm: NewAccountForm = {
  name: "",
  institution: "",
  type: "checking",
  initialBalance: "",
  includeInTotal: true,
};

export function NewAccountDialog({
  open,
  existingNames,
  onClose,
  onCreate,
}: {
  open: boolean;
  existingNames: string[];
  onClose: () => void;
  onCreate: (account: NewAccountInput) => void;
}) {
  const [form, setForm] = useState(initialForm);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", closeOnEscape);

    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [onClose, open]);

  if (!open) return null;

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const initialBalance = Number(form.initialBalance.replace(",", ".") || "0");

    if (!form.name.trim() || !form.institution.trim()) {
      setError(accountsContent.validation.required);
      return;
    }

    if (!Number.isFinite(initialBalance) || initialBalance < 0) {
      setError(accountsContent.validation.positiveAmount);
      return;
    }

    if (
      existingNames.some(
        (name) => name.toLocaleLowerCase("pt-BR") === form.name.trim().toLocaleLowerCase("pt-BR"),
      )
    ) {
      setError(accountsContent.validation.duplicateName);
      return;
    }

    const configuration = typeConfiguration[form.type];

    onCreate({
      name: form.name.trim(),
      institution: form.institution.trim(),
      type: form.type,
      group: configuration.group,
      icon: configuration.icon,
      initialBalance,
      includeInTotal: form.includeInTotal,
    });

    setForm(initialForm);
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
        aria-labelledby="new-account-title"
      >
        <header className="transaction-dialog-header">
          <div>
            <span className="page-eyebrow">
              {accountsContent.newAccountDialog.eyebrow}
            </span>
            <h2 id="new-account-title">
              {accountsContent.newAccountDialog.title}
            </h2>
            <p>{accountsContent.newAccountDialog.description}</p>
          </div>
          <button
            className="dialog-close-button"
            type="button"
            onClick={onClose}
            aria-label={accountsContent.newAccountDialog.closeAriaLabel}
          >
            <CloseIcon />
          </button>
        </header>

        <form className="transaction-form" onSubmit={submit}>
          <div className="transaction-form-grid">
            <label className="form-field">
              <span>{accountsContent.newAccountDialog.fields.name}</span>
              <input
                value={form.name}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
                placeholder={accountsContent.newAccountDialog.fields.namePlaceholder}
                autoFocus
              />
            </label>

            <label className="form-field">
              <span>{accountsContent.newAccountDialog.fields.institution}</span>
              <input
                value={form.institution}
                onChange={(event) =>
                  setForm({ ...form, institution: event.target.value })
                }
                placeholder={
                  accountsContent.newAccountDialog.fields.institutionPlaceholder
                }
              />
            </label>

            <label className="form-field">
              <span>{accountsContent.newAccountDialog.fields.type}</span>
              <select
                value={form.type}
                onChange={(event) =>
                  setForm({ ...form, type: event.target.value as AccountType })
                }
              >
                {(Object.keys(accountsContent.accountTypes) as AccountType[]).map(
                  (type) => (
                    <option value={type} key={type}>
                      {accountsContent.accountTypes[type]}
                    </option>
                  ),
                )}
              </select>
            </label>

            <label className="form-field">
              <span>{accountsContent.newAccountDialog.fields.initialBalance}</span>
              <div className="currency-input">
                <b>R$</b>
                <input
                  inputMode="decimal"
                  value={form.initialBalance}
                  onChange={(event) =>
                    setForm({ ...form, initialBalance: event.target.value })
                  }
                  placeholder="0,00"
                />
              </div>
            </label>
          </div>

          <label className="account-checkbox-field">
            <input
              type="checkbox"
              checked={form.includeInTotal}
              onChange={(event) =>
                setForm({ ...form, includeInTotal: event.target.checked })
              }
            />
            <span>{accountsContent.newAccountDialog.fields.includeInTotal}</span>
          </label>

          {error && <p className="transaction-form-error">{error}</p>}

          <footer className="transaction-dialog-footer">
            <button
              className="secondary-action-button"
              type="button"
              onClick={onClose}
            >
              {accountsContent.newAccountDialog.cancel}
            </button>
            <button className="primary-action-button" type="submit">
              {accountsContent.newAccountDialog.submit}
            </button>
          </footer>
        </form>
      </section>
    </div>
  );
}
