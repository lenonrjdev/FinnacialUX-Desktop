"use client";

import { useState } from "react";
import { CloseIcon } from "@/components/shared/icons";
import { receivablesContent } from "@/content/recebimentos";
import { formatCurrency } from "@/lib/formatters";
import { getReferenceDate } from "@/lib/reference-date";
import type { FinancialAccount } from "@/types/contas";
import type {
  Receivable,
  ReceivableReceiptInput,
} from "@/types/recebimentos";

type ReceiveReceivableDialogProps = {
  receivable: Receivable;
  accounts: FinancialAccount[];
  onClose: () => void;
  onSubmit: (input: ReceivableReceiptInput) => void;
};

function parseAmount(value: string): number {
  return Number(value.replace(/\./g, "").replace(",", "."));
}

export function ReceiveReceivableDialog({ receivable, accounts, onClose, onSubmit }: ReceiveReceivableDialogProps) {
  const remaining = Math.max(0, receivable.amount - receivable.receivedAmount);
  const [form, setForm] = useState({
    amount: remaining.toFixed(2).replace(".", ","),
    receivedDate: getReferenceDate(),
    accountId: receivable.accountId,
  });
  const [error, setError] = useState("");

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const amount = parseAmount(form.amount);

    if (!form.receivedDate || !form.accountId) {
      setError(receivablesContent.validation.required);
      return;
    }

    if (!Number.isFinite(amount) || amount <= 0) {
      setError(receivablesContent.validation.positiveAmount);
      return;
    }

    if (amount > remaining + 0.001) {
      setError(receivablesContent.validation.receiptLimit);
      return;
    }

    onSubmit({ receivableId: receivable.id, amount, receivedDate: form.receivedDate, accountId: form.accountId });
    onClose();
  }

  return (
    <div className="transaction-dialog-backdrop" role="presentation" onMouseDown={onClose}>
      <section className="transaction-dialog commitment-payment-dialog" role="dialog" aria-modal="true" aria-labelledby="receive-receivable-title" onMouseDown={(event) => event.stopPropagation()}>
        <header className="transaction-dialog-header">
          <div>
            <span className="section-eyebrow">{receivablesContent.receiptDialog.eyebrow}</span>
            <h2 id="receive-receivable-title">{receivablesContent.receiptDialog.title}</h2>
            <p>{receivablesContent.receiptDialog.description}</p>
          </div>
          <button className="dialog-close-button" type="button" onClick={onClose} aria-label={receivablesContent.receiptDialog.closeAriaLabel}><CloseIcon /></button>
        </header>

        <form className="transaction-form" onSubmit={submit}>
          <div className="commitment-payment-summary receivable-payment-summary">
            <div><span>{receivablesContent.receiptDialog.total}</span><strong>{formatCurrency(receivable.amount)}</strong></div>
            <div><span>{receivablesContent.receiptDialog.alreadyReceived}</span><strong>{formatCurrency(receivable.receivedAmount)}</strong></div>
            <div className="featured"><span>{receivablesContent.receiptDialog.remaining}</span><strong>{formatCurrency(remaining)}</strong></div>
          </div>

          <div className="transaction-form-grid">
            <label className="form-field">
              <span>{receivablesContent.receiptDialog.fields.amount}</span>
              <div className="currency-input"><b>R$</b><input inputMode="decimal" value={form.amount} onChange={(event) => setForm({ ...form, amount: event.target.value })} /></div>
            </label>
            <label className="form-field">
              <span>{receivablesContent.receiptDialog.fields.date}</span>
              <input type="date" value={form.receivedDate} onChange={(event) => setForm({ ...form, receivedDate: event.target.value })} />
            </label>
            <label className="form-field form-field-wide">
              <span>{receivablesContent.receiptDialog.fields.account}</span>
              <select value={form.accountId} onChange={(event) => setForm({ ...form, accountId: event.target.value })}>
                {accounts.map((account) => <option value={account.id} key={account.id}>{account.name}</option>)}
              </select>
            </label>
          </div>

          {error ? <p className="transaction-form-error">{error}</p> : null}

          <footer className="transaction-dialog-footer">
            <button className="secondary-action-button" type="button" onClick={onClose}>{receivablesContent.receiptDialog.cancel}</button>
            <button className="primary-action-button" type="submit">{receivablesContent.receiptDialog.submit}</button>
          </footer>
        </form>
      </section>
    </div>
  );
}
