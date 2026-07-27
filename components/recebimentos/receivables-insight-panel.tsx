import { CalendarIcon, IncomeIcon, WalletIcon } from "@/components/shared/icons";
import { receivablesContent } from "@/content/recebimentos";
import { formatCurrency, formatPercentage, formatShortDate } from "@/lib/formatters";
import type { Receivable } from "@/types/recebimentos";

type ReceivablesInsightPanelProps = {
  receivables: Receivable[];
  referenceDate: string;
};

export function ReceivablesInsightPanel({ receivables, referenceDate }: ReceivablesInsightPanelProps) {
  const month = referenceDate.slice(0, 7);
  const monthItems = receivables.filter((item) => item.expectedDate.startsWith(month));
  const expectedThisMonth = monthItems.reduce((total, item) => total + item.amount, 0);
  const confirmed = monthItems.reduce((total, item) => total + item.receivedAmount, 0);
  const recurringIncome = receivables
    .filter((item) => item.recurrence !== "none")
    .reduce((total, item) => total + item.amount, 0);
  const confirmedRate = expectedThisMonth > 0 ? (confirmed / expectedThisMonth) * 100 : 0;
  const nextReceipt = [...receivables]
    .filter((item) => item.status !== "received" && item.expectedDate >= referenceDate)
    .sort((a, b) => a.expectedDate.localeCompare(b.expectedDate))[0];

  return (
    <aside className="commitment-insight-panel receivables-insight-panel">
      <header>
        <span className="commitment-insight-icon"><IncomeIcon /></span>
        <div>
          <span className="section-eyebrow">{receivablesContent.insight.kicker}</span>
          <h2>{receivablesContent.insight.title}</h2>
        </div>
      </header>

      <p>{receivablesContent.insight.description}</p>

      <div className="commitment-insight-total">
        <span>{receivablesContent.insight.expectedThisMonth}</span>
        <strong>{formatCurrency(expectedThisMonth)}</strong>
      </div>

      <div className="commitment-insight-breakdown">
        <div>
          <span>{receivablesContent.insight.confirmedRate}</span>
          <strong>{formatPercentage(confirmedRate)}</strong>
          <small>{formatCurrency(confirmed)} confirmado</small>
        </div>
        <div>
          <span>{receivablesContent.insight.recurringIncome}</span>
          <strong>{formatCurrency(recurringIncome)}</strong>
          <small>previsão recorrente</small>
        </div>
      </div>

      <div className="commitment-progress-track income" aria-hidden="true">
        <span style={{ width: `${Math.min(100, Math.max(0, confirmedRate))}%` }} />
      </div>

      <div className="commitment-next-item">
        <span className="commitment-next-icon income"><CalendarIcon /></span>
        <div>
          <span>{receivablesContent.insight.nextReceipt}</span>
          <strong>{nextReceipt?.description ?? "Nenhuma entrada futura"}</strong>
          <small>{nextReceipt ? `${formatShortDate(nextReceipt.expectedDate)} · ${formatCurrency(Math.max(0, nextReceipt.amount - nextReceipt.receivedAmount))}` : "Previsão organizada"}</small>
        </div>
      </div>

      <div className="commitment-attention-box income">
        <WalletIcon />
        <div>
          <strong>{receivablesContent.insight.attentionTitle}</strong>
          <p>{receivablesContent.insight.attentionDescription}</p>
        </div>
      </div>
    </aside>
  );
}
