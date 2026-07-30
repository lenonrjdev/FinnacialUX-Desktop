import { ClockIcon, EditIcon, PlusIcon, TrashIcon } from "@/components/shared/icons";
import { automationsContent } from "@/content/automations";
import { automationFrequencyLabel } from "@/lib/automation-engine";
import { formatCurrency, formatShortDate } from "@/lib/formatters";
import type { RecurringTransactionTemplate } from "@/types/desktop-automations";

export function RecurrencesPanel({
  templates,
  readOnly,
  onCreate,
  onEdit,
  onToggle,
  onDelete,
}: {
  templates: RecurringTransactionTemplate[];
  readOnly: boolean;
  onCreate: () => void;
  onEdit: (template: RecurringTransactionTemplate) => void;
  onToggle: (template: RecurringTransactionTemplate) => void;
  onDelete: (template: RecurringTransactionTemplate) => void;
}) {
  return (
    <section className="data-tool-panel recurrence-panel">
      <header className="data-tool-panel-header rules-panel-header">
        <div>
          <span className="section-eyebrow">{automationsContent.recurrences.eyebrow}</span>
          <h2>{automationsContent.recurrences.title}</h2>
          <p>{automationsContent.recurrences.description}</p>
        </div>
        <button className="primary-action-button" type="button" disabled={readOnly} onClick={onCreate}><PlusIcon />{automationsContent.recurrences.create}</button>
      </header>
      <div className="recurrence-list">
        {templates.length ? [...templates].sort((a, b) => a.nextRunAt.localeCompare(b.nextRunAt)).map((template) => (
          <article className={`recurrence-card ${template.active ? "active" : "paused"}`} key={template.id}>
            <span className="recurrence-icon"><ClockIcon /></span>
            <div className="recurrence-content">
              <div><strong>{template.name}</strong><span>{template.active ? "Ativa" : "Pausada"}</span></div>
              <p>{template.transaction.description}</p>
              <div className="recurrence-meta">
                <span>{formatCurrency(template.transaction.amount)}</span>
                <span>{automationFrequencyLabel(template.frequency)}{template.interval > 1 ? ` · a cada ${template.interval}` : ""}</span>
                <span>{automationsContent.recurrences.next}: {formatShortDate(template.nextRunAt)}</span>
                <span>{automationsContent.recurrences.last}: {template.lastRunAt ? formatShortDate(template.lastRunAt) : "—"}</span>
              </div>
            </div>
            <div className="recurrence-actions">
              <button type="button" disabled={readOnly} onClick={() => onEdit(template)}><EditIcon />{automationsContent.recurrences.edit}</button>
              <button type="button" disabled={readOnly} onClick={() => onToggle(template)}>{template.active ? automationsContent.recurrences.pause : automationsContent.recurrences.activate}</button>
              <button className="danger" type="button" disabled={readOnly} onClick={() => onDelete(template)}><TrashIcon />{automationsContent.recurrences.remove}</button>
            </div>
          </article>
        )) : <p className="data-tools-empty-copy">{automationsContent.recurrences.empty}</p>}
      </div>
    </section>
  );
}
