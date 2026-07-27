import { DebtTypeIcon } from "@/components/dividas/debt-icon";
import { MoreIcon, ReceiptIcon } from "@/components/shared/icons";
import { debtsContent } from "@/content/dividas";
import { financialIntelligenceContent } from "@/content/financial-intelligence";
import { formatCurrency, formatPercentage, formatShortDate } from "@/lib/formatters";
import type { DebtRow } from "@/types/dividas";

export function DebtCard({
  debt,
  accountName,
  selected,
  onSelect,
  onPay,
  onEdit,
  onSettle,
}: {
  debt: DebtRow;
  accountName: string;
  selected: boolean;
  onSelect: () => void;
  onPay: () => void;
  onEdit: () => void;
  onSettle: () => void;
}) {
  const isPaid = debt.computedStatus === "paid";
  const progress = Math.min(debt.progress, 100);

  return (
    <article className={`debt-card ${selected ? "selected" : ""} ${isPaid ? "paid" : ""}`} onClick={onSelect}>
      <header className="debt-card-header">
        <div className="debt-card-identity">
          <span className={`debt-card-icon ${debt.type}`}><DebtTypeIcon type={debt.type} /></span>
          <div>
            <div className="debt-card-badges">
              <span className={`debt-status-badge ${debt.computedStatus}`}>{debtsContent.statuses[debt.computedStatus]}</span>
              <span className={`debt-priority-badge ${debt.priority}`}>{debtsContent.priorities[debt.priority]}</span>
            </div>
            <h3>{debt.name}</h3>
            <p>{debt.creditor}</p>
          </div>
        </div>
        {!debt.generated ? (
          <button className="debt-menu-button" type="button" aria-label={`${debtsContent.accessibility.debtActions}: ${debt.name}`} onClick={(event) => { event.stopPropagation(); onEdit(); }}>
            <MoreIcon />
          </button>
        ) : (
          <span className="smart-source-badge">{financialIntelligenceContent.recurring.automatic}</span>
        )}
      </header>

      <div className="debt-balance-block">
        <span>{debtsContent.list.balance}</span>
        <strong>{formatCurrency(debt.currentBalance)}</strong>
        <small>{debtsContent.list.originalPrefix} {formatCurrency(debt.originalAmount)}</small>
      </div>

      <div className="debt-progress-block">
        <div>
          <span>{debtsContent.details.progress}</span>
          <strong>{formatPercentage(debt.progress)}</strong>
        </div>
        <div className={`debt-progress-track ${debt.computedStatus}`}><span style={{ width: `${progress}%` }} /></div>
      </div>

      <div className="debt-card-details">
        <div><span>{debtsContent.list.installment}</span><strong>{formatCurrency(debt.installmentAmount)}</strong></div>
        <div><span>{debtsContent.list.nextDue}</span><strong>{isPaid ? "—" : formatShortDate(debt.nextDueDate)}</strong></div>
        <div><span>{debtsContent.list.interest}</span><strong>{formatPercentage(debt.annualInterestRate)}</strong></div>
        <div><span>{debtsContent.list.installments}</span><strong>{debt.remainingInstallments} {debtsContent.list.remaining}</strong></div>
      </div>

      <footer className="debt-card-footer">
        <button className="debt-pay-button" type="button" disabled={isPaid} onClick={(event) => { event.stopPropagation(); onPay(); }}>
          <ReceiptIcon />
          {debtsContent.list.pay}
        </button>
        <div>
          {!debt.generated ? (
            <button type="button" onClick={(event) => { event.stopPropagation(); onEdit(); }}>{debtsContent.list.edit}</button>
          ) : null}
          {!isPaid ? <button type="button" onClick={(event) => { event.stopPropagation(); onSettle(); }}>{debtsContent.list.settle}</button> : null}
        </div>
      </footer>

      <span className="debt-card-account">{accountName}</span>
    </article>
  );
}
