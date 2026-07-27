import { CalendarIcon, ClockIcon, DebtIcon, ReportsIcon } from "@/components/shared/icons";
import { debtsContent } from "@/content/dividas";
import { formatCurrency, formatPercentage, formatShortDate } from "@/lib/formatters";
import type { DebtRow } from "@/types/dividas";

function visibleInstallments(debt: DebtRow) {
  const size = Math.min(debt.totalInstallments, 12);
  const start = Math.max(1, Math.min(debt.paidInstallments - 2, debt.totalInstallments - size + 1));
  return Array.from({ length: size }, (_, index) => start + index);
}

export function DebtDetailsPanel({ debt, accountName }: { debt?: DebtRow; accountName?: string }) {
  if (!debt) {
    return (
      <aside className="debt-details-panel debt-panel-empty">
        <span><DebtIcon /></span>
        <p>{debtsContent.details.noSelection}</p>
      </aside>
    );
  }

  const installments = visibleInstallments(debt);
  const hiddenCount = Math.max(debt.totalInstallments - installments.length, 0);

  return (
    <aside className="debt-details-panel">
      <header className="debt-panel-header">
        <div>
          <span className="section-eyebrow">{debtsContent.details.eyebrow}</span>
          <h2>{debt.name}</h2>
          <p>{debt.creditor}</p>
        </div>
        <span className={`debt-status-badge ${debt.computedStatus}`}>{debtsContent.statuses[debt.computedStatus]}</span>
      </header>

      <div className="debt-detail-balance">
        <span>{debtsContent.list.balance}</span>
        <strong>{formatCurrency(debt.currentBalance)}</strong>
        <div className="debt-progress-track"><span style={{ width: `${Math.min(debt.progress, 100)}%` }} /></div>
        <small>{formatPercentage(debt.progress)} {debtsContent.details.progressSuffix}</small>
      </div>

      <div className="debt-detail-metrics">
        <div><span className="debt-detail-metric-icon"><ReportsIcon /></span><span>{debtsContent.details.paidPrincipal}</span><strong>{formatCurrency(debt.paidPrincipal)}</strong></div>
        <div><span className="debt-detail-metric-icon"><DebtIcon /></span><span>{debtsContent.details.remainingInterest}</span><strong>{formatCurrency(debt.estimatedRemainingInterest)}</strong></div>
        <div><span className="debt-detail-metric-icon"><CalendarIcon /></span><span>{debtsContent.details.startDate}</span><strong>{formatShortDate(debt.startDate)}</strong></div>
        <div><span className="debt-detail-metric-icon"><ClockIcon /></span><span>{debtsContent.details.nextDue}</span><strong>{debt.computedStatus === "paid" ? "—" : formatShortDate(debt.nextDueDate)}</strong></div>
      </div>

      <div className="debt-contract-data">
        <div><span>{debtsContent.list.installment}</span><strong>{formatCurrency(debt.installmentAmount)}</strong></div>
        <div><span>{debtsContent.list.interest}</span><strong>{formatPercentage(debt.annualInterestRate)}</strong></div>
        <div><span>{debtsContent.list.account}</span><strong>{accountName ?? debtsContent.list.unknownAccount}</strong></div>
        <div><span>{debtsContent.list.installments}</span><strong>{debt.paidInstallments}/{debt.totalInstallments}</strong></div>
      </div>

      <div className="debt-installment-timeline">
        <div className="debt-timeline-heading"><span>{debtsContent.details.timeline}</span><small>{debt.remainingInstallments} {debtsContent.list.remaining}</small></div>
        <div className="debt-installment-grid">
          {installments.map((number) => {
            const state = number <= debt.paidInstallments
              ? "completed"
              : number === debt.paidInstallments + 1
                ? debt.computedStatus === "overdue" ? "overdue" : "next"
                : "future";
            return (
              <span className={`debt-installment ${state}`} key={number} title={
                state === "completed" ? debtsContent.details.completedInstallment
                  : state === "overdue" ? debtsContent.details.overdueInstallment
                    : state === "next" ? debtsContent.details.nextInstallment
                      : debtsContent.details.futureInstallment
              }>{number}</span>
            );
          })}
        </div>
        {hiddenCount > 0 ? <small className="debt-hidden-installments">+ {hiddenCount} {debtsContent.details.moreInstallments}</small> : null}
      </div>

      {debt.notes ? <p className="debt-notes">{debt.notes}</p> : null}
    </aside>
  );
}
