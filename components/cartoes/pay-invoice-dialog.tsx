"use client";

import { FormEvent, useEffect, useState } from "react";
import { CloseIcon } from "@/components/shared/icons";
import { cardsContent } from "@/content/cartoes";
import { formatCurrency } from "@/lib/formatters";
import { getReferenceDate } from "@/lib/reference-date";
import type { FinancialAccount } from "@/types/contas";
import type { CardInvoice, InvoicePaymentInput } from "@/types/cartoes";

export function PayInvoiceDialog({
  open,
  invoice,
  defaultAccountId,
  accounts,
  onClose,
  onPay,
}: {
  open: boolean;
  invoice?: CardInvoice;
  defaultAccountId: string;
  accounts: FinancialAccount[];
  onClose: () => void;
  onPay: (input: InvoicePaymentInput) => void;
}) {
  const [accountId, setAccountId] = useState(defaultAccountId);
  const [paymentDate, setPaymentDate] = useState(() => getReferenceDate());
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setAccountId(defaultAccountId || accounts[0]?.id || "");
    setPaymentDate(getReferenceDate());

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", closeOnEscape);

    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [accounts, defaultAccountId, onClose, open]);

  if (!open || !invoice) return null;

  const activeInvoice = invoice;

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!accountId || !paymentDate) {
      setError(cardsContent.validation.required);
      return;
    }

    onPay({ invoiceId: activeInvoice.id, accountId, paymentDate });
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
        className="transaction-dialog payment-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="pay-invoice-title"
      >
        <header className="transaction-dialog-header">
          <div>
            <span className="page-eyebrow">{cardsContent.paymentDialog.eyebrow}</span>
            <h2 id="pay-invoice-title">{cardsContent.paymentDialog.title}</h2>
            <p>{cardsContent.paymentDialog.description}</p>
          </div>
          <button
            className="dialog-close-button"
            type="button"
            onClick={onClose}
            aria-label={cardsContent.paymentDialog.closeAriaLabel}
          >
            <CloseIcon />
          </button>
        </header>

        <form className="transaction-form" onSubmit={submit}>
          <div className="invoice-payment-amount">
            <span>{cardsContent.paymentDialog.fields.amount}</span>
            <strong>{formatCurrency(activeInvoice.amount)}</strong>
            <small>{activeInvoice.referenceLabel}</small>
          </div>

          <div className="transaction-form-grid">
            <label className="form-field">
              <span>{cardsContent.paymentDialog.fields.account}</span>
              <select value={accountId} onChange={(event) => setAccountId(event.target.value)}>
                {accounts.map((account) => (
                  <option value={account.id} key={account.id}>{account.name}</option>
                ))}
              </select>
            </label>

            <label className="form-field">
              <span>{cardsContent.paymentDialog.fields.date}</span>
              <input
                type="date"
                value={paymentDate}
                onChange={(event) => setPaymentDate(event.target.value)}
              />
            </label>
          </div>

          <p className="invoice-payment-note">{cardsContent.paymentDialog.note}</p>
          {error && <p className="transaction-form-error">{error}</p>}

          <footer className="transaction-dialog-footer">
            <button className="secondary-action-button" type="button" onClick={onClose}>
              {cardsContent.paymentDialog.cancel}
            </button>
            <button className="primary-action-button" type="submit">
              {cardsContent.paymentDialog.submit}
            </button>
          </footer>
        </form>
      </section>
    </div>
  );
}
