"use client";

import { useState } from "react";
import { CloseIcon } from "@/components/shared/icons";
import { goalsContent } from "@/content/metas";
import type {
  FinancialGoal,
  GoalCategory,
  GoalFormInput,
  GoalKind,
  GoalPriority,
  GoalTone,
} from "@/types/metas";

const categories = Object.keys(goalsContent.categories) as GoalCategory[];
const priorities = Object.keys(goalsContent.priorities) as GoalPriority[];
const tones: GoalTone[] = ["graphite", "sage", "sand", "violet", "rose", "blue"];

export function GoalDialog({
  editing,
  accounts,
  onClose,
  onSubmit,
}: {
  editing?: FinancialGoal | null;
  accounts: Array<{ id: string; name: string }>;
  onClose: () => void;
  onSubmit: (input: GoalFormInput) => void;
}) {
  const [name, setName] = useState(editing?.name ?? "");
  const [description, setDescription] = useState(editing?.description ?? "");
  const [kind, setKind] = useState<GoalKind>(editing?.kind ?? "goal");
  const [category, setCategory] = useState<GoalCategory>(editing?.category ?? "other");
  const [tone, setTone] = useState<GoalTone>(editing?.tone ?? "graphite");
  const [targetAmount, setTargetAmount] = useState(editing ? String(editing.targetAmount) : "");
  const [currentAmount, setCurrentAmount] = useState(editing ? String(editing.currentAmount) : "0");
  const [monthlyContribution, setMonthlyContribution] = useState(editing ? String(editing.monthlyContribution) : "0");
  const [targetDate, setTargetDate] = useState(editing?.targetDate ?? "2027-12-31");
  const [accountId, setAccountId] = useState(editing?.accountId ?? accounts[0]?.id ?? "");
  const [priority, setPriority] = useState<GoalPriority>(editing?.priority ?? "medium");
  const [error, setError] = useState("");

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsedTarget = Number(targetAmount);
    const parsedCurrent = Number(currentAmount);
    const parsedMonthly = Number(monthlyContribution);

    if (!name.trim() || !description.trim() || !targetAmount || !targetDate || !accountId) {
      setError(goalsContent.goalDialog.required);
      return;
    }
    if (!Number.isFinite(parsedTarget) || parsedTarget <= 0) {
      setError(goalsContent.goalDialog.invalidTarget);
      return;
    }
    if (!Number.isFinite(parsedCurrent) || parsedCurrent < 0 || parsedCurrent > parsedTarget) {
      setError(goalsContent.goalDialog.invalidCurrent);
      return;
    }
    if (!Number.isFinite(parsedMonthly) || parsedMonthly < 0) {
      setError(goalsContent.goalDialog.invalidMonthly);
      return;
    }

    onSubmit({
      name: name.trim(),
      description: description.trim(),
      kind,
      category,
      tone,
      targetAmount: parsedTarget,
      currentAmount: parsedCurrent,
      monthlyContribution: parsedMonthly,
      targetDate,
      accountId,
      priority,
    });
  }

  return (
    <div className="transaction-dialog-backdrop" role="presentation" onMouseDown={onClose}>
      <section className="transaction-dialog goal-dialog" role="dialog" aria-modal="true" aria-labelledby="goal-dialog-title" onMouseDown={(event: React.MouseEvent<HTMLElement>) => event.stopPropagation()}>
        <header className="transaction-dialog-header">
          <div>
            <span className="section-eyebrow">{goalsContent.goalDialog.eyebrow}</span>
            <h2 id="goal-dialog-title">{editing ? goalsContent.goalDialog.editTitle : goalsContent.goalDialog.createTitle}</h2>
            <p>{goalsContent.goalDialog.description}</p>
          </div>
          <button className="dialog-close-button" type="button" onClick={onClose} aria-label={goalsContent.accessibility.closeDialog}><CloseIcon /></button>
        </header>

        <form className="transaction-form" onSubmit={submit}>
          <div className="goal-dialog-grid">
            <label className="form-field goal-name-field">
              <span>{goalsContent.goalDialog.name}</span>
              <input value={name} onChange={(event) => setName(event.target.value)} placeholder={goalsContent.goalDialog.namePlaceholder} />
            </label>
            <label className="form-field goal-description-field">
              <span>{goalsContent.goalDialog.descriptionLabel}</span>
              <textarea value={description} onChange={(event) => setDescription(event.target.value)} placeholder={goalsContent.goalDialog.descriptionPlaceholder} />
            </label>
            <label className="form-field">
              <span>{goalsContent.goalDialog.kind}</span>
              <select value={kind} onChange={(event) => setKind(event.target.value as GoalKind)}>
                <option value="goal">{goalsContent.goalDialog.goal}</option>
                <option value="reserve">{goalsContent.goalDialog.reserve}</option>
              </select>
            </label>
            <label className="form-field">
              <span>{goalsContent.goalDialog.category}</span>
              <select value={category} onChange={(event) => setCategory(event.target.value as GoalCategory)}>
                {categories.map((item) => <option value={item} key={item}>{goalsContent.categories[item]}</option>)}
              </select>
            </label>
            <label className="form-field">
              <span>{goalsContent.goalDialog.targetAmount}</span>
              <input type="number" min="0" step="0.01" value={targetAmount} onChange={(event) => setTargetAmount(event.target.value)} placeholder="0,00" />
            </label>
            <label className="form-field">
              <span>{goalsContent.goalDialog.currentAmount}</span>
              <input type="number" min="0" step="0.01" value={currentAmount} onChange={(event) => setCurrentAmount(event.target.value)} placeholder="0,00" />
            </label>
            <label className="form-field">
              <span>{goalsContent.goalDialog.monthlyContribution}</span>
              <input type="number" min="0" step="0.01" value={monthlyContribution} onChange={(event) => setMonthlyContribution(event.target.value)} placeholder="0,00" />
            </label>
            <label className="form-field">
              <span>{goalsContent.goalDialog.targetDate}</span>
              <input type="date" value={targetDate} onChange={(event) => setTargetDate(event.target.value)} />
            </label>
            <label className="form-field">
              <span>{goalsContent.goalDialog.account}</span>
              <select value={accountId} onChange={(event) => setAccountId(event.target.value)}>
                {accounts.map((account) => <option value={account.id} key={account.id}>{account.name}</option>)}
              </select>
            </label>
            <label className="form-field">
              <span>{goalsContent.goalDialog.priority}</span>
              <select value={priority} onChange={(event) => setPriority(event.target.value as GoalPriority)}>
                {priorities.map((item) => <option value={item} key={item}>{goalsContent.priorities[item]}</option>)}
              </select>
            </label>
            <fieldset className="category-tone-selector goal-tone-selector">
              <legend>{goalsContent.goalDialog.visual}</legend>
              <div>
                {tones.map((item) => (
                  <button className={`${item} ${tone === item ? "active" : ""}`} type="button" key={item} onClick={() => setTone(item)} aria-label={item}>
                    <span />
                  </button>
                ))}
              </div>
            </fieldset>
          </div>

          {error ? <p className="form-error-message">{error}</p> : null}
          <footer className="transaction-dialog-footer">
            <button type="button" className="secondary-action-button" onClick={onClose}>{goalsContent.goalDialog.cancel}</button>
            <button type="submit" className="primary-action-button">{editing ? goalsContent.goalDialog.save : goalsContent.goalDialog.create}</button>
          </footer>
        </form>
      </section>
    </div>
  );
}
