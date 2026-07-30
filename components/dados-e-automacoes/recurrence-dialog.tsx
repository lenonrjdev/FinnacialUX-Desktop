"use client";

import { useState } from "react";
import { CloseIcon } from "@/components/shared/icons";
import { automationsContent } from "@/content/automations";
import { getReferenceDate } from "@/lib/reference-date";
import type {
  AutomationFrequency,
  RecurringTransactionTemplate,
  RecurringTransactionTemplateInput,
} from "@/types/desktop-automations";
import type { TransactionStatus, TransactionType } from "@/types/lancamentos";

export function RecurrenceDialog({
  editing,
  categories,
  accounts,
  onClose,
  onSubmit,
}: {
  editing: RecurringTransactionTemplate | null;
  categories: string[];
  accounts: string[];
  onClose: () => void;
  onSubmit: (input: RecurringTransactionTemplateInput) => void;
}) {
  const [name, setName] = useState(editing?.name ?? "");
  const [description, setDescription] = useState(editing?.transaction.description ?? "");
  const [category, setCategory] = useState(editing?.transaction.category ?? categories[0] ?? "");
  const [account, setAccount] = useState(editing?.transaction.account ?? accounts[0] ?? "");
  const [paymentMethod, setPaymentMethod] = useState(editing?.transaction.paymentMethod ?? "Débito em conta");
  const [amount, setAmount] = useState(String(editing?.transaction.amount ?? ""));
  const [type, setType] = useState<TransactionType>(editing?.transaction.type ?? "expense");
  const [status, setStatus] = useState<TransactionStatus>(editing?.transaction.status ?? "pending");
  const [frequency, setFrequency] = useState<AutomationFrequency>(editing?.frequency ?? "monthly");
  const [interval, setInterval] = useState(editing?.interval ?? 1);
  const [nextRunAt, setNextRunAt] = useState(editing?.nextRunAt ?? getReferenceDate());
  const [note, setNote] = useState(editing?.transaction.note ?? "");
  const [active, setActive] = useState(editing?.active ?? true);
  const [error, setError] = useState("");

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsedAmount = Number(amount.replace(",", "."));
    if (!name.trim() || !description.trim() || !account || !nextRunAt || !Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setError(automationsContent.dialog.required);
      return;
    }
    onSubmit({
      name: name.trim(),
      active,
      frequency,
      interval: Math.max(1, Math.min(24, Math.trunc(interval))),
      nextRunAt,
      transaction: {
        description: description.trim(),
        category,
        account,
        paymentMethod: paymentMethod.trim() || "Automação local",
        amount: parsedAmount,
        type,
        status,
        note: note.trim() || undefined,
      },
    });
  }

  return (
    <div className="transaction-dialog-backdrop" role="presentation" onMouseDown={onClose}>
      <section className="transaction-dialog recurrence-dialog" role="dialog" aria-modal="true" aria-labelledby="recurrence-dialog-title" onMouseDown={(event) => event.stopPropagation()}>
        <header className="transaction-dialog-header">
          <div><span className="section-eyebrow">{automationsContent.recurrences.eyebrow}</span><h2 id="recurrence-dialog-title">{editing ? automationsContent.dialog.editTitle : automationsContent.dialog.createTitle}</h2></div>
          <button className="dialog-close-button" type="button" onClick={onClose} aria-label="Fechar formulário"><CloseIcon /></button>
        </header>
        <form className="transaction-form" onSubmit={submit}>
          <div className="rule-form-grid recurrence-form-grid">
            <label className="form-field rule-name-field"><span>{automationsContent.dialog.name}</span><input value={name} onChange={(event) => setName(event.target.value)} /></label>
            <label className="form-field rule-value-field"><span>{automationsContent.dialog.description}</span><input value={description} onChange={(event) => setDescription(event.target.value)} /></label>
            <label className="form-field"><span>{automationsContent.dialog.category}</span><select value={category} onChange={(event) => setCategory(event.target.value)}>{categories.map((item) => <option key={item}>{item}</option>)}</select></label>
            <label className="form-field"><span>{automationsContent.dialog.account}</span><select value={account} onChange={(event) => setAccount(event.target.value)}>{accounts.map((item) => <option key={item}>{item}</option>)}</select></label>
            <label className="form-field"><span>{automationsContent.dialog.paymentMethod}</span><input value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value)} /></label>
            <label className="form-field"><span>{automationsContent.dialog.amount}</span><input inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} /></label>
            <label className="form-field"><span>{automationsContent.dialog.type}</span><select value={type} onChange={(event) => setType(event.target.value as TransactionType)}><option value="expense">Despesa</option><option value="income">Receita</option><option value="transfer">Transferência</option></select></label>
            <label className="form-field"><span>{automationsContent.dialog.status}</span><select value={status} onChange={(event) => setStatus(event.target.value as TransactionStatus)}><option value="pending">Pendente</option><option value="completed">Concluída</option><option value="overdue">Vencida</option></select></label>
            <label className="form-field"><span>{automationsContent.dialog.frequency}</span><select value={frequency} onChange={(event) => setFrequency(event.target.value as AutomationFrequency)}><option value="weekly">Semanal</option><option value="monthly">Mensal</option><option value="quarterly">Trimestral</option><option value="yearly">Anual</option></select></label>
            <label className="form-field"><span>{automationsContent.dialog.interval}</span><input type="number" min={1} max={24} value={interval} onChange={(event) => setInterval(Number(event.target.value) || 1)} /></label>
            <label className="form-field"><span>{automationsContent.dialog.nextRunAt}</span><input type="date" value={nextRunAt} onChange={(event) => setNextRunAt(event.target.value)} /></label>
            <label className="form-field rule-value-field"><span>{automationsContent.dialog.note}</span><input value={note} onChange={(event) => setNote(event.target.value)} /></label>
          </div>
          <label className="rule-active-field"><input type="checkbox" checked={active} onChange={(event) => setActive(event.target.checked)} /><span>{automationsContent.dialog.active}</span></label>
          {error ? <p className="form-error-message">{error}</p> : null}
          <footer className="transaction-dialog-footer"><button type="button" className="secondary-action-button" onClick={onClose}>{automationsContent.dialog.cancel}</button><button type="submit" className="primary-action-button">{automationsContent.dialog.save}</button></footer>
        </form>
      </section>
    </div>
  );
}
