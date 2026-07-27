"use client";

import { useMemo, useState } from "react";
import { CloseIcon } from "@/components/shared/icons";
import { goalsContent } from "@/content/metas";
import type { ContributionFormInput, ContributionType, GoalRow } from "@/types/metas";

export function ContributionDialog({
  goals,
  accounts,
  initialGoalId,
  referenceDate,
  onClose,
  onSubmit,
}: {
  goals: GoalRow[];
  accounts: Array<{ id: string; name: string }>;
  initialGoalId?: string;
  referenceDate: string;
  onClose: () => void;
  onSubmit: (input: ContributionFormInput) => void;
}) {
  const availableGoals = useMemo(() => goals.filter((goal) => goal.status !== "completed"), [goals]);
  const [goalId, setGoalId] = useState(initialGoalId && availableGoals.some((goal) => goal.id === initialGoalId) ? initialGoalId : availableGoals[0]?.id ?? "");
  const selectedGoal = availableGoals.find((goal) => goal.id === goalId);
  const [type, setType] = useState<ContributionType>("deposit");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(referenceDate);
  const [accountId, setAccountId] = useState(selectedGoal?.accountId ?? accounts[0]?.id ?? "");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");

  function changeGoal(nextGoalId: string) {
    setGoalId(nextGoalId);
    const nextGoal = availableGoals.find((goal) => goal.id === nextGoalId);
    if (nextGoal) setAccountId(nextGoal.accountId);
  }

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsedAmount = Number(amount);
    if (!goalId || !amount || !date || !accountId || !note.trim()) {
      setError(goalsContent.contributionDialog.required);
      return;
    }
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setError(goalsContent.contributionDialog.invalidAmount);
      return;
    }
    if (type === "withdrawal" && parsedAmount > (selectedGoal?.currentAmount ?? 0)) {
      setError(goalsContent.contributionDialog.insufficient);
      return;
    }
    onSubmit({ goalId, accountId, type, amount: parsedAmount, date, note: note.trim() });
  }

  return (
    <div className="transaction-dialog-backdrop" role="presentation" onMouseDown={onClose}>
      <section className="transaction-dialog contribution-dialog" role="dialog" aria-modal="true" aria-labelledby="contribution-dialog-title" onMouseDown={(event: React.MouseEvent<HTMLElement>) => event.stopPropagation()}>
        <header className="transaction-dialog-header">
          <div>
            <span className="section-eyebrow">{goalsContent.contributionDialog.eyebrow}</span>
            <h2 id="contribution-dialog-title">{goalsContent.contributionDialog.title}</h2>
            <p>{goalsContent.contributionDialog.description}</p>
          </div>
          <button className="dialog-close-button" type="button" onClick={onClose} aria-label={goalsContent.accessibility.closeDialog}><CloseIcon /></button>
        </header>

        <form className="transaction-form" onSubmit={submit}>
          <div className="contribution-dialog-grid">
            <label className="form-field contribution-goal-field">
              <span>{goalsContent.contributionDialog.goal}</span>
              <select value={goalId} onChange={(event) => changeGoal(event.target.value)}>
                {availableGoals.map((goal) => <option value={goal.id} key={goal.id}>{goal.name}</option>)}
              </select>
            </label>
            <label className="form-field">
              <span>{goalsContent.contributionDialog.type}</span>
              <select value={type} onChange={(event) => setType(event.target.value as ContributionType)}>
                <option value="deposit">{goalsContent.contributionDialog.deposit}</option>
                <option value="withdrawal">{goalsContent.contributionDialog.withdrawal}</option>
              </select>
            </label>
            <label className="form-field">
              <span>{goalsContent.contributionDialog.amount}</span>
              <input type="number" min="0" step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="0,00" />
            </label>
            <label className="form-field">
              <span>{goalsContent.contributionDialog.date}</span>
              <input type="date" value={date} onChange={(event) => setDate(event.target.value)} />
            </label>
            <label className="form-field">
              <span>{goalsContent.contributionDialog.account}</span>
              <select value={accountId} onChange={(event) => setAccountId(event.target.value)}>
                {accounts.map((account) => <option value={account.id} key={account.id}>{account.name}</option>)}
              </select>
            </label>
            <label className="form-field contribution-note-field">
              <span>{goalsContent.contributionDialog.note}</span>
              <textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder={goalsContent.contributionDialog.notePlaceholder} />
            </label>
          </div>
          {error ? <p className="form-error-message">{error}</p> : null}
          <footer className="transaction-dialog-footer">
            <button type="button" className="secondary-action-button" onClick={onClose}>{goalsContent.contributionDialog.cancel}</button>
            <button type="submit" className="primary-action-button">{goalsContent.contributionDialog.submit}</button>
          </footer>
        </form>
      </section>
    </div>
  );
}
