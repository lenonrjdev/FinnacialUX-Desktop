import { useState } from "react";
import { CloseIcon } from "@/components/shared/icons";
import { debtsContent } from "@/content/dividas";
import { addMonthsToDate } from "@/lib/financial-intelligence";
import { getReferenceDate } from "@/lib/reference-date";
import type { DebtFormInput, FinancialDebt } from "@/types/dividas";

function createEmptyForm(accounts: Array<{ id: string; name: string }>): DebtFormInput {
  const startDate = getReferenceDate();
  return {
    name: "",
    creditor: "",
    type: "personal-loan",
    originalAmount: 0,
    currentBalance: 0,
    annualInterestRate: 0,
    totalInstallments: 1,
    paidInstallments: 0,
    installmentAmount: 0,
    nextDueDate: addMonthsToDate(startDate, 1),
    startDate,
    accountId: accounts[0]?.id ?? "",
    status: "active",
    priority: "medium",
    notes: "",
  };
}

export function DebtDialog({
  editing,
  accounts,
  onClose,
  onSubmit,
}: {
  editing: FinancialDebt | null;
  accounts: Array<{ id: string; name: string }>;
  onClose: () => void;
  onSubmit: (input: DebtFormInput) => void;
}) {
  const [form, setForm] = useState<DebtFormInput>(editing ? {
    name: editing.name,
    creditor: editing.creditor,
    type: editing.type,
    originalAmount: editing.originalAmount,
    currentBalance: editing.currentBalance,
    annualInterestRate: editing.annualInterestRate,
    totalInstallments: editing.totalInstallments,
    paidInstallments: editing.paidInstallments,
    installmentAmount: editing.installmentAmount,
    nextDueDate: editing.nextDueDate,
    startDate: editing.startDate,
    accountId: editing.accountId,
    status: editing.status,
    priority: editing.priority,
    notes: editing.notes,
  } : createEmptyForm(accounts));
  const [error, setError] = useState("");

  function update<K extends keyof DebtFormInput>(key: K, value: DebtFormInput[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form.name.trim() || !form.creditor.trim() || !form.accountId || !form.nextDueDate || !form.startDate) {
      setError(debtsContent.debtDialog.requiredError);
      return;
    }
    if (form.originalAmount <= 0 || form.currentBalance < 0 || form.installmentAmount <= 0 || form.totalInstallments <= 0 || form.annualInterestRate < 0) {
      setError(debtsContent.debtDialog.valuesError);
      return;
    }
    if (form.paidInstallments < 0 || form.paidInstallments > form.totalInstallments) {
      setError(debtsContent.debtDialog.installmentsError);
      return;
    }
    onSubmit({ ...form, name: form.name.trim(), creditor: form.creditor.trim(), notes: form.notes.trim() });
  }

  return (
    <div className="transaction-dialog-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div className="transaction-dialog debt-dialog" role="dialog" aria-modal="true" aria-labelledby="debt-dialog-title">
        <header className="transaction-dialog-header">
          <div><h2 id="debt-dialog-title">{editing ? debtsContent.debtDialog.editTitle : debtsContent.debtDialog.createTitle}</h2><p>{editing ? debtsContent.debtDialog.editDescription : debtsContent.debtDialog.createDescription}</p></div>
          <button className="dialog-close-button" type="button" onClick={onClose} aria-label={debtsContent.accessibility.closeDialog}><CloseIcon /></button>
        </header>

        <form className="transaction-form" onSubmit={submit}>
          <div className="debt-dialog-grid">
            <label className="form-field debt-name-field"><span>{debtsContent.debtDialog.name}</span><input value={form.name} onChange={(event) => update("name", event.target.value)} /></label>
            <label className="form-field"><span>{debtsContent.debtDialog.creditor}</span><input value={form.creditor} onChange={(event) => update("creditor", event.target.value)} /></label>
            <label className="form-field"><span>{debtsContent.debtDialog.type}</span><select value={form.type} onChange={(event) => update("type", event.target.value as DebtFormInput["type"])}>{Object.entries(debtsContent.types).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
            <label className="form-field"><span>{debtsContent.debtDialog.originalAmount}</span><div className="currency-input"><b>R$</b><input type="number" min="0" step="0.01" value={form.originalAmount || ""} onChange={(event) => update("originalAmount", Number(event.target.value))} /></div></label>
            <label className="form-field"><span>{debtsContent.debtDialog.currentBalance}</span><div className="currency-input"><b>R$</b><input type="number" min="0" step="0.01" value={form.currentBalance || ""} onChange={(event) => update("currentBalance", Number(event.target.value))} /></div></label>
            <label className="form-field"><span>{debtsContent.debtDialog.annualInterestRate}</span><div className="debt-percentage-input"><input type="number" min="0" step="0.1" value={form.annualInterestRate} onChange={(event) => update("annualInterestRate", Number(event.target.value))} /><b>%</b></div></label>
            <label className="form-field"><span>{debtsContent.debtDialog.totalInstallments}</span><input type="number" min="1" value={form.totalInstallments} onChange={(event) => update("totalInstallments", Number(event.target.value))} /></label>
            <label className="form-field"><span>{debtsContent.debtDialog.paidInstallments}</span><input type="number" min="0" value={form.paidInstallments} onChange={(event) => update("paidInstallments", Number(event.target.value))} /></label>
            <label className="form-field"><span>{debtsContent.debtDialog.installmentAmount}</span><div className="currency-input"><b>R$</b><input type="number" min="0" step="0.01" value={form.installmentAmount || ""} onChange={(event) => update("installmentAmount", Number(event.target.value))} /></div></label>
            <label className="form-field"><span>{debtsContent.debtDialog.startDate}</span><input type="date" value={form.startDate} onChange={(event) => update("startDate", event.target.value)} /></label>
            <label className="form-field"><span>{debtsContent.debtDialog.nextDueDate}</span><input type="date" value={form.nextDueDate} onChange={(event) => update("nextDueDate", event.target.value)} /></label>
            <label className="form-field"><span>{debtsContent.debtDialog.account}</span><select value={form.accountId} onChange={(event) => update("accountId", event.target.value)}>{accounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}</select></label>
            <label className="form-field"><span>{debtsContent.debtDialog.priority}</span><select value={form.priority} onChange={(event) => update("priority", event.target.value as DebtFormInput["priority"])}>{Object.entries(debtsContent.priorities).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
            <label className="form-field"><span>{debtsContent.debtDialog.status}</span><select value={form.status} onChange={(event) => update("status", event.target.value as DebtFormInput["status"])}>{Object.entries(debtsContent.statuses).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
            <label className="form-field debt-notes-field"><span>{debtsContent.debtDialog.notes}</span><textarea value={form.notes} placeholder={debtsContent.debtDialog.notesPlaceholder} onChange={(event) => update("notes", event.target.value)} /></label>
          </div>
          {error ? <p className="transaction-form-error">{error}</p> : null}
          <footer className="transaction-dialog-footer"><button className="secondary-action-button" type="button" onClick={onClose}>{debtsContent.debtDialog.cancel}</button><button className="primary-action-button" type="submit">{editing ? debtsContent.debtDialog.save : debtsContent.debtDialog.create}</button></footer>
        </form>
      </div>
    </div>
  );
}
