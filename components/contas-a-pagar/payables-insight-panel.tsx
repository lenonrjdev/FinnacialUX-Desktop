import { BillsIcon, CalendarIcon, ClockIcon } from "@/components/shared/icons";
import { payablesContent } from "@/content/contas-a-pagar";
import { formatCurrency, formatPercentage, formatShortDate } from "@/lib/formatters";
import type { Payable } from "@/types/contas-a-pagar";

type PayablesInsightPanelProps = {
  payables: Payable[];
  referenceDate: string;
};

export function PayablesInsightPanel({ payables, referenceDate }: PayablesInsightPanelProps) {
  const month = referenceDate.slice(0, 7);
  const active = payables.filter((item) => item.status !== "paid");
  const committedThisMonth = payables
    .filter((item) => item.dueDate.startsWith(month))
    .reduce((total, item) => total + item.amount, 0);
  const fixed = payables
    .filter((item) => item.dueDate.startsWith(month) && item.valueType === "fixed")
    .reduce((total, item) => total + item.amount, 0);
  const variable = payables
    .filter((item) => item.dueDate.startsWith(month) && item.valueType === "variable")
    .reduce((total, item) => total + item.amount, 0);
  const nextDue = [...active]
    .filter((item) => item.dueDate >= referenceDate)
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))[0];
  const fixedPercentage = committedThisMonth > 0 ? (fixed / committedThisMonth) * 100 : 0;

  return (
    <aside className="commitment-insight-panel">
      <header>
        <span className="commitment-insight-icon"><BillsIcon /></span>
        <div>
          <span className="section-eyebrow">{payablesContent.insight.kicker}</span>
          <h2>{payablesContent.insight.title}</h2>
        </div>
      </header>

      <p>{payablesContent.insight.description}</p>

      <div className="commitment-insight-total">
        <span>{payablesContent.insight.committedThisMonth}</span>
        <strong>{formatCurrency(committedThisMonth)}</strong>
      </div>

      <div className="commitment-insight-breakdown">
        <div>
          <span>{payablesContent.insight.fixedExpenses}</span>
          <strong>{formatCurrency(fixed)}</strong>
          <small>{formatPercentage(fixedPercentage)} do total</small>
        </div>
        <div>
          <span>{payablesContent.insight.variableExpenses}</span>
          <strong>{formatCurrency(variable)}</strong>
          <small>{formatPercentage(100 - fixedPercentage)} do total</small>
        </div>
      </div>

      <div className="commitment-progress-track" aria-hidden="true">
        <span style={{ width: `${Math.min(100, Math.max(0, fixedPercentage))}%` }} />
      </div>

      <div className="commitment-next-item">
        <span className="commitment-next-icon"><CalendarIcon /></span>
        <div>
          <span>{payablesContent.insight.nextDue}</span>
          <strong>{nextDue?.description ?? "Nenhum compromisso futuro"}</strong>
          <small>{nextDue ? `${formatShortDate(nextDue.dueDate)} · ${formatCurrency(Math.max(0, nextDue.amount - nextDue.paidAmount))}` : "Agenda organizada"}</small>
        </div>
      </div>

      <div className="commitment-attention-box">
        <ClockIcon />
        <div>
          <strong>{payablesContent.insight.attentionTitle}</strong>
          <p>{payablesContent.insight.attentionDescription}</p>
        </div>
      </div>
    </aside>
  );
}
