import { useState } from "react";
import { CloseIcon } from "@/components/shared/icons";
import { subscriptionsContent } from "@/content/assinaturas";
import type {
  BillingCycle,
  PersonalSubscription,
  SubscriptionCategory,
  SubscriptionFormInput,
  SubscriptionStatus,
  UsageFrequency,
} from "@/types/assinaturas";

const categoryOptions = Object.keys(subscriptionsContent.categories) as SubscriptionCategory[];
const cycleOptions = Object.keys(subscriptionsContent.billingCycles) as BillingCycle[];
const statusOptions = Object.keys(subscriptionsContent.statuses) as SubscriptionStatus[];
const usageOptions = Object.keys(subscriptionsContent.usages) as UsageFrequency[];

export function SubscriptionDialog({
  editing,
  accounts,
  referenceDate,
  onClose,
  onSubmit,
}: {
  editing: PersonalSubscription | null;
  accounts: Array<{ id: string; name: string }>;
  referenceDate: string;
  onClose: () => void;
  onSubmit: (input: SubscriptionFormInput) => void;
}) {
  const [name, setName] = useState(editing?.name ?? "");
  const [provider, setProvider] = useState(editing?.provider ?? "");
  const [category, setCategory] = useState<SubscriptionCategory>(editing?.category ?? "streaming");
  const [amount, setAmount] = useState(editing?.amount ? String(editing.amount) : "");
  const [billingCycle, setBillingCycle] = useState<BillingCycle>(editing?.billingCycle ?? "monthly");
  const [nextChargeDate, setNextChargeDate] = useState(editing?.nextChargeDate ?? referenceDate);
  const [accountId, setAccountId] = useState(editing?.accountId ?? accounts[0]?.id ?? "");
  const [status, setStatus] = useState<SubscriptionStatus>(editing?.status ?? "active");
  const [autoRenew, setAutoRenew] = useState(editing?.autoRenew ?? true);
  const [startDate, setStartDate] = useState(editing?.startDate ?? referenceDate);
  const [trialEndsAt, setTrialEndsAt] = useState(editing?.trialEndsAt ?? "");
  const [previousAmount, setPreviousAmount] = useState(editing?.previousAmount ? String(editing.previousAmount) : "");
  const [priceChangedAt, setPriceChangedAt] = useState(editing?.priceChangedAt ?? "");
  const [usage, setUsage] = useState<UsageFrequency>(editing?.usage ?? "unknown");
  const [notes, setNotes] = useState(editing?.notes ?? "");
  const [error, setError] = useState("");

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const numericAmount = Number(amount);
    const numericPreviousAmount = previousAmount ? Number(previousAmount) : undefined;

    if (!name.trim() || !provider.trim() || !accountId || !nextChargeDate || !startDate) {
      setError(subscriptionsContent.subscriptionDialog.requiredError);
      return;
    }
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      setError(subscriptionsContent.subscriptionDialog.amountError);
      return;
    }

    onSubmit({
      name: name.trim(),
      provider: provider.trim(),
      category,
      amount: numericAmount,
      billingCycle,
      nextChargeDate,
      accountId,
      status,
      autoRenew,
      startDate,
      trialEndsAt: trialEndsAt || undefined,
      previousAmount: numericPreviousAmount && numericPreviousAmount > 0 ? numericPreviousAmount : undefined,
      priceChangedAt: priceChangedAt || undefined,
      usage,
      notes: notes.trim(),
    });
  }

  return (
    <div className="transaction-dialog-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="transaction-dialog subscription-dialog" role="dialog" aria-modal="true" aria-labelledby="subscription-dialog-title">
        <header className="transaction-dialog-header">
          <div>
            <h2 id="subscription-dialog-title">{editing ? subscriptionsContent.subscriptionDialog.editTitle : subscriptionsContent.subscriptionDialog.createTitle}</h2>
            <p>{editing ? subscriptionsContent.subscriptionDialog.editDescription : subscriptionsContent.subscriptionDialog.createDescription}</p>
          </div>
          <button className="dialog-close-button" type="button" onClick={onClose} aria-label={subscriptionsContent.accessibility.closeDialog}><CloseIcon /></button>
        </header>

        <form className="transaction-form" onSubmit={submit}>
          <div className="subscription-dialog-grid">
            <label className="form-field subscription-name-field"><span>{subscriptionsContent.subscriptionDialog.name}</span><input value={name} onChange={(event) => setName(event.target.value)} placeholder={subscriptionsContent.subscriptionDialog.namePlaceholder} /></label>
            <label className="form-field subscription-provider-field"><span>{subscriptionsContent.subscriptionDialog.provider}</span><input value={provider} onChange={(event) => setProvider(event.target.value)} placeholder={subscriptionsContent.subscriptionDialog.providerPlaceholder} /></label>
            <label className="form-field"><span>{subscriptionsContent.subscriptionDialog.category}</span><select value={category} onChange={(event) => setCategory(event.target.value as SubscriptionCategory)}>{categoryOptions.map((item) => <option key={item} value={item}>{subscriptionsContent.categories[item]}</option>)}</select></label>
            <label className="form-field"><span>{subscriptionsContent.subscriptionDialog.amount}</span><div className="currency-input"><b>R$</b><input type="number" min="0.01" step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="0,00" /></div></label>
            <label className="form-field"><span>{subscriptionsContent.subscriptionDialog.billingCycle}</span><select value={billingCycle} onChange={(event) => setBillingCycle(event.target.value as BillingCycle)}>{cycleOptions.map((item) => <option key={item} value={item}>{subscriptionsContent.billingCycles[item]}</option>)}</select></label>
            <label className="form-field"><span>{subscriptionsContent.subscriptionDialog.nextChargeDate}</span><input type="date" value={nextChargeDate} onChange={(event) => setNextChargeDate(event.target.value)} /></label>
            <label className="form-field"><span>{subscriptionsContent.subscriptionDialog.account}</span><select value={accountId} onChange={(event) => setAccountId(event.target.value)}>{accounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}</select></label>
            <label className="form-field"><span>{subscriptionsContent.subscriptionDialog.status}</span><select value={status} onChange={(event) => setStatus(event.target.value as SubscriptionStatus)}>{statusOptions.map((item) => <option key={item} value={item}>{subscriptionsContent.statuses[item]}</option>)}</select></label>
            <label className="form-field"><span>{subscriptionsContent.subscriptionDialog.startDate}</span><input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} /></label>
            <label className="form-field"><span>{subscriptionsContent.subscriptionDialog.trialEndsAt}</span><input type="date" value={trialEndsAt} onChange={(event) => setTrialEndsAt(event.target.value)} /></label>
            <label className="form-field"><span>{subscriptionsContent.subscriptionDialog.previousAmount}</span><div className="currency-input"><b>R$</b><input type="number" min="0" step="0.01" value={previousAmount} onChange={(event) => setPreviousAmount(event.target.value)} placeholder="0,00" /></div></label>
            <label className="form-field"><span>{subscriptionsContent.subscriptionDialog.priceChangedAt}</span><input type="date" value={priceChangedAt} onChange={(event) => setPriceChangedAt(event.target.value)} /></label>
            <label className="form-field"><span>{subscriptionsContent.subscriptionDialog.usage}</span><select value={usage} onChange={(event) => setUsage(event.target.value as UsageFrequency)}>{usageOptions.map((item) => <option key={item} value={item}>{subscriptionsContent.usages[item]}</option>)}</select></label>
            <label className="subscription-renewal-toggle">
              <input type="checkbox" checked={autoRenew} onChange={(event) => setAutoRenew(event.target.checked)} />
              <span><strong>{subscriptionsContent.subscriptionDialog.autoRenew}</strong><small>{autoRenew ? subscriptionsContent.list.autoRenew : subscriptionsContent.list.manualRenew}</small></span>
            </label>
            <label className="form-field subscription-notes-field"><span>{subscriptionsContent.subscriptionDialog.notes}</span><textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder={subscriptionsContent.subscriptionDialog.notesPlaceholder} /></label>
          </div>

          {error ? <p className="transaction-form-error">{error}</p> : null}
          <footer className="transaction-dialog-footer">
            <button className="secondary-action-button" type="button" onClick={onClose}>{subscriptionsContent.subscriptionDialog.cancel}</button>
            <button className="primary-action-button" type="submit">{editing ? subscriptionsContent.subscriptionDialog.save : subscriptionsContent.subscriptionDialog.create}</button>
          </footer>
        </form>
      </section>
    </div>
  );
}
