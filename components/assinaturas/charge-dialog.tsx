import { useState } from "react";
import { CloseIcon } from "@/components/shared/icons";
import { subscriptionsContent } from "@/content/assinaturas";
import { formatCurrency, formatShortDate } from "@/lib/formatters";
import type { SubscriptionChargeInput, SubscriptionRow } from "@/types/assinaturas";

export function ChargeDialog({
  subscriptions,
  accounts,
  initialSubscriptionId,
  referenceDate,
  onClose,
  onSubmit,
}: {
  subscriptions: SubscriptionRow[];
  accounts: Array<{ id: string; name: string }>;
  initialSubscriptionId?: string;
  referenceDate: string;
  onClose: () => void;
  onSubmit: (input: SubscriptionChargeInput) => void;
}) {
  const firstSubscription = subscriptions.find((item) => item.id === initialSubscriptionId)
    ?? subscriptions.find((item) => item.status === "active" || item.status === "trial")
    ?? subscriptions[0];
  const [subscriptionId, setSubscriptionId] = useState(firstSubscription?.id ?? "");
  const selected = subscriptions.find((item) => item.id === subscriptionId) ?? firstSubscription;
  const [date, setDate] = useState(referenceDate);
  const [amount, setAmount] = useState(selected?.amount ?? 0);
  const [accountId, setAccountId] = useState(selected?.accountId ?? accounts[0]?.id ?? "");
  const [status, setStatus] = useState<SubscriptionChargeInput["status"]>("paid");
  const [note, setNote] = useState<string>(subscriptionsContent.chargeDialog.defaultNote);
  const [error, setError] = useState("");

  function changeSubscription(value: string) {
    const next = subscriptions.find((item) => item.id === value);
    setSubscriptionId(value);
    if (next) {
      setAmount(next.amount);
      setAccountId(next.accountId);
    }
  }

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected || !subscriptionId || !accountId || !date) {
      setError(subscriptionsContent.chargeDialog.requiredError);
      return;
    }
    if (status !== "skipped" && amount <= 0) {
      setError(subscriptionsContent.chargeDialog.amountError);
      return;
    }
    onSubmit({ subscriptionId, date, amount: status === "skipped" ? 0 : amount, accountId, status, note: note.trim() });
  }

  if (!selected) return null;

  return (
    <div className="transaction-dialog-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="transaction-dialog subscription-charge-dialog" role="dialog" aria-modal="true" aria-labelledby="subscription-charge-title">
        <header className="transaction-dialog-header">
          <div><h2 id="subscription-charge-title">{subscriptionsContent.chargeDialog.title}</h2><p>{subscriptionsContent.chargeDialog.description}</p></div>
          <button className="dialog-close-button" type="button" onClick={onClose} aria-label={subscriptionsContent.accessibility.closeDialog}><CloseIcon /></button>
        </header>
        <form className="transaction-form" onSubmit={submit}>
          <div className="subscription-charge-grid">
            <label className="form-field subscription-charge-subscription-field"><span>{subscriptionsContent.chargeDialog.subscription}</span><select value={subscriptionId} onChange={(event) => changeSubscription(event.target.value)}>{subscriptions.filter((item) => item.status !== "cancelled").map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
            <label className="form-field"><span>{subscriptionsContent.chargeDialog.date}</span><input type="date" value={date} onChange={(event) => setDate(event.target.value)} /></label>
            <label className="form-field"><span>{subscriptionsContent.chargeDialog.amount}</span><div className="currency-input"><b>R$</b><input type="number" min="0" step="0.01" value={amount} onChange={(event) => setAmount(Number(event.target.value))} disabled={status === "skipped"} /></div></label>
            <label className="form-field"><span>{subscriptionsContent.chargeDialog.account}</span><select value={accountId} onChange={(event) => setAccountId(event.target.value)}>{accounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}</select></label>
            <label className="form-field"><span>{subscriptionsContent.chargeDialog.status}</span><select value={status} onChange={(event) => setStatus(event.target.value as SubscriptionChargeInput["status"])}><option value="paid">{subscriptionsContent.chargeStatuses.paid}</option><option value="scheduled">{subscriptionsContent.chargeStatuses.scheduled}</option><option value="skipped">{subscriptionsContent.chargeStatuses.skipped}</option></select></label>
            <label className="form-field subscription-charge-note-field"><span>{subscriptionsContent.chargeDialog.note}</span><textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder={subscriptionsContent.chargeDialog.notePlaceholder} /></label>
          </div>

          <div className="subscription-charge-preview">
            <div><span>{subscriptionsContent.chargeDialog.expectedAmount}</span><strong>{formatCurrency(selected.amount)}</strong></div>
            <div><span>{subscriptionsContent.chargeDialog.nextCharge}</span><strong>{formatShortDate(selected.nextChargeDate)}</strong></div>
          </div>

          {error ? <p className="transaction-form-error">{error}</p> : null}
          <footer className="transaction-dialog-footer"><button className="secondary-action-button" type="button" onClick={onClose}>{subscriptionsContent.chargeDialog.cancel}</button><button className="primary-action-button" type="submit">{subscriptionsContent.chargeDialog.confirm}</button></footer>
        </form>
      </section>
    </div>
  );
}
