"use client";

import { useState } from "react";
import { CloseIcon } from "@/components/shared/icons";
import { payablesContent } from "@/content/contas-a-pagar";
import { formatCurrency } from "@/lib/formatters";
import { getReferenceDate } from "@/lib/reference-date";
import type { FinancialAccount } from "@/types/contas";
import type { Payable, PayablePaymentInput } from "@/types/contas-a-pagar";

type PayPayableDialogProps = {
  payable: Payable;
  accounts: FinancialAccount[];
  onClose: () => void;
  onSubmit: (input: PayablePaymentInput) => void;
};

function parseAmount(value: string): number {
  return Number(value.replace(/\./g, "").replace(",", "."));
}

export function PayPayableDialog({ payable, accounts, onClose, onSubmit }: PayPayableDialogProps) {
  const remaining = Math.max(0, payable.amount - payable.paidAmount);
  const [form, setForm] = useState({
    amount: remaining.toFixed(2).replace(".", ","),
    paymentDate: getReferenceDate(),
    accountId: payable.accountId,
  });
  const [error, setError] = useState("");

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const amount = parseAmount(form.amount);

    if (!form.paymentDate || !form.accountId) {
      setError(payablesContent.validation.required);
      return;
    }

    if (!Number.isFinite(amount) || amount <= 0) {
      setError(payablesContent.validation.positiveAmount);
      return;
    }

    if (amount > remaining + 0.001) {
      setError(payablesContent.validation.paymentLimit);
      return;
    }

    onSubmit({ payableId: payable.id, amount, paymentDate: form.paymentDate, accountId: form.accountId });
    onClose();
  }

  return (
    <div className="transaction-dialog-backdrop" role="presentation" onMouseDown={onClose}>
      <section className="transaction-dialog commitment-payment-dialog" role="dialog" aria-modal="true" aria-labelledby="pay-payable-title" onMouseDown={(event) => event.stopPropagation()}>
        <header className="transaction-dialog-header">
          <div>
            <span className="section-eyebrow">{payablesContent.paymentDialog.eyebrow}</span>
            <h2 id="pay-payable-title">{payablesContent.paymentDialog.title}</h2>
            <p>{payablesContent.paymentDialog.description}</p>
          </div>
          <button className="dialog-close-button" type="button" onClick={onClose} aria-label={payablesContent.paymentDialog.closeAriaLabel}><CloseIcon /></button>
        </header>

        <form className="transaction-form" onSubmit={submit}>
          <div className="commitment-payment-summary">
            <div><span>{payablesContent.paymentDialog.total}</span><strong>{formatCurrency(payable.amount)}</strong></div>
            <div><span>{payablesContent.paymentDialog.alreadyPaid}</span><strong>{formatCurrency(payable.paidAmount)}</strong></div>
            <div className="featured"><span>{payablesContent.paymentDialog.remaining}</span><strong>{formatCurrency(remaining)}</strong></div>
          </div>

          <div className="transaction-form-grid">
            <label className="form-field">
              <span>{payablesContent.paymentDialog.fields.amount}</span>
              <div className="currency-input"><b>R$</b><input inputMode="decimal" value={form.amount} onChange={(event) => setForm({ ...form, amount: event.target.value })} /></div>
            </label>
            <label className="form-field">
              <span>{payablesContent.paymentDialog.fields.date}</span>
              <input type="date" value={form.paymentDate} onChange={(event) => setForm({ ...form, paymentDate: event.target.value })} />
            </label>
            <label className="form-field form-field-wide">
              <span>{payablesContent.paymentDialog.fields.account}</span>
              <select value={form.accountId} onChange={(event) => setForm({ ...form, accountId: event.target.value })}>
                {accounts.map((account) => <option value={account.id} key={account.id}>{account.name}</option>)}
              </select>
            </label>
          </div>

          {error ? <p className="transaction-form-error">{error}</p> : null}

          <footer className="transaction-dialog-footer">
            <button className="secondary-action-button" type="button" onClick={onClose}>{payablesContent.paymentDialog.cancel}</button>
            <button className="primary-action-button" type="submit">{payablesContent.paymentDialog.submit}</button>
          </footer>
        </form>
      </section>
    </div>
  );
}
