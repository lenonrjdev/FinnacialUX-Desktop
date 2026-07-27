"use client";

import { useState } from "react";
import { CloseIcon } from "@/components/shared/icons";
import { dataToolsContent } from "@/content/dados-e-automacoes";
import type {
  AutomationRule,
  AutomationRuleInput,
  ImportRowType,
  RuleField,
  RuleOperator,
} from "@/types/dados-e-automacoes";

export function RuleDialog({
  editing,
  categories,
  accounts,
  onClose,
  onSubmit,
}: {
  editing: AutomationRule | null;
  categories: string[];
  accounts: string[];
  onClose: () => void;
  onSubmit: (input: AutomationRuleInput) => void;
}) {
  const [name, setName] = useState(editing?.name ?? "");
  const [field, setField] = useState<RuleField>(editing?.field ?? "description");
  const [operator, setOperator] = useState<RuleOperator>(editing?.operator ?? "contains");
  const [value, setValue] = useState(editing?.value ?? "");
  const [category, setCategory] = useState(editing?.actions.category ?? "");
  const [account, setAccount] = useState(editing?.actions.account ?? "");
  const [type, setType] = useState<ImportRowType | "">(editing?.actions.type ?? "");
  const [active, setActive] = useState(editing?.active ?? true);
  const [error, setError] = useState("");

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!name.trim() || !value.trim() || (!category && !account && !type)) {
      setError(dataToolsContent.ruleDialog.required);
      return;
    }
    onSubmit({
      name: name.trim(),
      field,
      operator,
      value: value.trim(),
      active,
      actions: {
        category: category || undefined,
        account: account || undefined,
        type: type || undefined,
      },
    });
  }

  return (
    <div className="transaction-dialog-backdrop" role="presentation" onMouseDown={onClose}>
      <section className="transaction-dialog rule-dialog" role="dialog" aria-modal="true" aria-labelledby="rule-dialog-title" onMouseDown={(event: React.MouseEvent<HTMLElement>) => event.stopPropagation()}>
        <header className="transaction-dialog-header">
          <div>
            <span className="section-eyebrow">{dataToolsContent.ruleDialog.eyebrow}</span>
            <h2 id="rule-dialog-title">{editing ? dataToolsContent.ruleDialog.editTitle : dataToolsContent.ruleDialog.createTitle}</h2>
            <p>{dataToolsContent.ruleDialog.description}</p>
          </div>
          <button className="dialog-close-button" type="button" onClick={onClose} aria-label={dataToolsContent.accessibility.closeDialog}><CloseIcon /></button>
        </header>
        <form className="transaction-form" onSubmit={submit}>
          <div className="rule-form-grid">
            <label className="form-field rule-name-field">
              <span>{dataToolsContent.ruleDialog.name}</span>
              <input value={name} onChange={(event: React.ChangeEvent<HTMLInputElement>) => setName(event.target.value)} placeholder={dataToolsContent.ruleDialog.namePlaceholder} />
            </label>
            <label className="form-field">
              <span>{dataToolsContent.ruleDialog.field}</span>
              <select value={field} onChange={(event: React.ChangeEvent<HTMLSelectElement>) => setField(event.target.value as RuleField)}>
                {(Object.keys(dataToolsContent.rules.fields) as RuleField[]).map((item) => <option value={item} key={item}>{dataToolsContent.rules.fields[item]}</option>)}
              </select>
            </label>
            <label className="form-field">
              <span>{dataToolsContent.ruleDialog.operator}</span>
              <select value={operator} onChange={(event: React.ChangeEvent<HTMLSelectElement>) => setOperator(event.target.value as RuleOperator)}>
                {(Object.keys(dataToolsContent.rules.operators) as RuleOperator[]).map((item) => <option value={item} key={item}>{dataToolsContent.rules.operators[item]}</option>)}
              </select>
            </label>
            <label className="form-field rule-value-field">
              <span>{dataToolsContent.ruleDialog.value}</span>
              <input value={value} onChange={(event: React.ChangeEvent<HTMLInputElement>) => setValue(event.target.value)} placeholder={dataToolsContent.ruleDialog.valuePlaceholder} />
            </label>
          </div>
          <div className="rule-actions-section">
            <h3>{dataToolsContent.ruleDialog.actionsTitle}</h3>
            <div className="rule-form-grid actions">
              <label className="form-field">
                <span>{dataToolsContent.ruleDialog.category}</span>
                <select value={category} onChange={(event: React.ChangeEvent<HTMLSelectElement>) => setCategory(event.target.value)}>
                  <option value="">{dataToolsContent.ruleDialog.keepCurrent}</option>
                  {categories.map((item) => <option value={item} key={item}>{item}</option>)}
                </select>
              </label>
              <label className="form-field">
                <span>{dataToolsContent.ruleDialog.account}</span>
                <select value={account} onChange={(event: React.ChangeEvent<HTMLSelectElement>) => setAccount(event.target.value)}>
                  <option value="">{dataToolsContent.ruleDialog.keepCurrent}</option>
                  {accounts.map((item) => <option value={item} key={item}>{item}</option>)}
                </select>
              </label>
              <label className="form-field">
                <span>{dataToolsContent.ruleDialog.type}</span>
                <select value={type} onChange={(event: React.ChangeEvent<HTMLSelectElement>) => setType(event.target.value as ImportRowType | "")}>
                  <option value="">{dataToolsContent.ruleDialog.keepCurrent}</option>
                  <option value="income">{dataToolsContent.preview.income}</option>
                  <option value="expense">{dataToolsContent.preview.expense}</option>
                  <option value="transfer">{dataToolsContent.preview.transfer}</option>
                </select>
              </label>
            </div>
          </div>
          <label className="rule-active-field">
            <input type="checkbox" checked={active} onChange={(event: React.ChangeEvent<HTMLInputElement>) => setActive(event.target.checked)} />
            <span>{dataToolsContent.ruleDialog.active}</span>
          </label>
          {error ? <p className="form-error-message">{error}</p> : null}
          <footer className="transaction-dialog-footer">
            <button type="button" className="secondary-action-button" onClick={onClose}>{dataToolsContent.ruleDialog.cancel}</button>
            <button type="submit" className="primary-action-button">{editing ? dataToolsContent.ruleDialog.save : dataToolsContent.ruleDialog.create}</button>
          </footer>
        </form>
      </section>
    </div>
  );
}
