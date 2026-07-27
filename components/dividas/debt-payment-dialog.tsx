import { useMemo, useState } from "react";
import { CloseIcon } from "@/components/shared/icons";
import { debtsContent } from "@/content/dividas";
import { formatCurrency } from "@/lib/formatters";
import type { DebtPaymentInput, DebtRow } from "@/types/dividas";

function paymentBreakdown(debt: DebtRow, amount: number) {
  const interest = Math.min(debt.currentBalance * (debt.annualInterestRate / 1200), amount);
  const principal = Math.max(amount - interest, 0);
  return { interest, principal };
}

export function DebtPaymentDialog({
  debts,
  accounts,
  initialDebtId,
  settle,
  referenceDate,
  onClose,
  onSubmit,
}: {
  debts: DebtRow[];
  accounts: Array<{ id: string; name: string }>;
  initialDebtId?: string;
  settle?: boolean;
  referenceDate: string;
  onClose: () => void;
  onSubmit: (input: DebtPaymentInput) => void;
}) {
  const firstDebt = debts.find((debt) => debt.id === initialDebtId) ?? debts.find((debt) => debt.computedStatus !== "paid") ?? debts[0];
  const [debtId, setDebtId] = useState(firstDebt?.id ?? "");
  const debt = debts.find((item) => item.id === debtId) ?? firstDebt;
  const estimatedSettlement = debt ? debt.currentBalance + debt.currentBalance * (debt.annualInterestRate / 1200) : 0;
  const [amount, setAmount] = useState(settle ? estimatedSettlement : debt?.installmentAmount ?? 0);
  const [date, setDate] = useState(referenceDate);
  const [accountId, setAccountId] = useState(debt?.accountId ?? accounts[0]?.id ?? "");
  const [note, setNote] = useState<string>(settle ? debtsContent.paymentDialog.settlementNote : debtsContent.paymentDialog.defaultNote);
  const [error, setError] = useState("");
  const breakdown = useMemo(() => debt ? paymentBreakdown(debt, amount) : { interest: 0, principal: 0 }, [amount, debt]);

  function changeDebt(value: string) {
    const next = debts.find((item) => item.id === value);
    setDebtId(value);
    if (next) {
      const nextSettlement = next.currentBalance + next.currentBalance * (next.annualInterestRate / 1200);
      setAmount(settle ? nextSettlement : next.installmentAmount);
      setAccountId(next.accountId);
    }
  }

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!debt || !debtId || !accountId || !date || amount <= 0) {
      setError(debtsContent.paymentDialog.requiredError);
      return;
    }
    if (amount > estimatedSettlement + 0.01) {
      setError(debtsContent.paymentDialog.amountError);
      return;
    }
    onSubmit({ debtId, date, amount, accountId, note: note.trim() });
  }

  if (!debt) return null;

  return (
    <div className="transaction-dialog-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div className="transaction-dialog debt-payment-dialog" role="dialog" aria-modal="true" aria-labelledby="debt-payment-title">
        <header className="transaction-dialog-header">
          <div><h2 id="debt-payment-title">{debtsContent.paymentDialog.title}</h2><p>{debtsContent.paymentDialog.description}</p></div>
          <button className="dialog-close-button" type="button" onClick={onClose} aria-label={debtsContent.accessibility.closeDialog}><CloseIcon /></button>
        </header>
        <form className="transaction-form" onSubmit={submit}>
          <div className="debt-payment-grid">
            <label className="form-field debt-payment-debt-field"><span>{debtsContent.paymentDialog.debt}</span><select value={debtId} onChange={(event) => changeDebt(event.target.value)}>{debts.filter((item) => item.computedStatus !== "paid").map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
            <label className="form-field"><span>{debtsContent.paymentDialog.date}</span><input type="date" value={date} onChange={(event) => setDate(event.target.value)} /></label>
            <label className="form-field"><span>{debtsContent.paymentDialog.amount}</span><div className="currency-input"><b>R$</b><input type="number" min="0.01" step="0.01" value={Number(amount.toFixed(2))} onChange={(event) => setAmount(Number(event.target.value))} /></div></label>
            <label className="form-field"><span>{debtsContent.paymentDialog.account}</span><select value={accountId} onChange={(event) => setAccountId(event.target.value)}>{accounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}</select></label>
            <label className="form-field debt-payment-note-field"><span>{debtsContent.paymentDialog.note}</span><textarea value={note} placeholder={debtsContent.paymentDialog.notePlaceholder} onChange={(event) => setNote(event.target.value)} /></label>
          </div>

          <div className="debt-payment-preview">
            <div><span>{debtsContent.paymentDialog.scheduledAmount}</span><strong>{formatCurrency(debt.installmentAmount)}</strong></div>
            <div><span>{debtsContent.paymentDialog.currentBalance}</span><strong>{formatCurrency(debt.currentBalance)}</strong></div>
            <div><span>{debtsContent.paymentDialog.estimatedInterest}</span><strong>{formatCurrency(breakdown.interest)}</strong></div>
            <div><span>{debtsContent.paymentDialog.estimatedPrincipal}</span><strong>{formatCurrency(breakdown.principal)}</strong></div>
          </div>

          {error ? <p className="transaction-form-error">{error}</p> : null}
          <footer className="transaction-dialog-footer"><button className="secondary-action-button" type="button" onClick={onClose}>{debtsContent.paymentDialog.cancel}</button><button className="primary-action-button" type="submit">{debtsContent.paymentDialog.confirm}</button></footer>
        </form>
      </div>
    </div>
  );
}
