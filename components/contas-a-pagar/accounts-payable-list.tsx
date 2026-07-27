import {
  BillsIcon,
  CalendarIcon,
  CheckIcon,
  ClockIcon,
  WalletIcon,
} from "@/components/shared/icons";
import { payablesContent } from "@/content/contas-a-pagar";
import { financialIntelligenceContent } from "@/content/financial-intelligence";
import { formatCurrency, formatShortDate } from "@/lib/formatters";
import type { FinancialAccount } from "@/types/contas";
import type { UnifiedPayable } from "@/types/financial-intelligence";

type AccountsPayableListProps = {
  payables: UnifiedPayable[];
  accounts: FinancialAccount[];
  onPay: (payableId: string) => void;
};

function accountName(accounts: FinancialAccount[], id: string): string {
  return accounts.find((account) => account.id === id)?.name ?? "Conta não encontrada";
}

export function AccountsPayableList({
  payables,
  accounts,
  onPay,
}: AccountsPayableListProps) {
  return (
    <section className="commitment-list-card">
      <header className="commitment-list-header">
        <div>
          <span className="section-eyebrow">{payablesContent.list.kicker}</span>
          <h2>{payablesContent.list.title}</h2>
        </div>
        <span>{payables.length} {payablesContent.list.countSuffix}</span>
      </header>

      {payables.length === 0 ? (
        <div className="commitment-empty-state">
          <span className="commitment-empty-icon"><BillsIcon /></span>
          <strong>{payablesContent.list.emptyTitle}</strong>
          <p>{payablesContent.list.emptyDescription}</p>
        </div>
      ) : (
        <>
          <div className="commitment-table-wrap">
            <table className="commitment-table">
              <thead>
                <tr>
                  <th>{payablesContent.list.columns.description}</th>
                  <th>{payablesContent.list.columns.dueDate}</th>
                  <th>{payablesContent.list.columns.category}</th>
                  <th>{payablesContent.list.columns.account}</th>
                  <th>{payablesContent.list.columns.status}</th>
                  <th>{payablesContent.list.columns.remaining}</th>
                  <th><span className="sr-only">{payablesContent.list.columns.actions}</span></th>
                </tr>
              </thead>
              <tbody>
                {payables.map((payable) => {
                  const remaining = Math.max(0, payable.amount - payable.paidAmount);

                  return (
                    <tr key={payable.id}>
                      <td>
                        <div className="commitment-description-cell">
                          <span className="commitment-row-icon"><BillsIcon /></span>
                          <div>
                            <strong>{payable.description}</strong>
                            <span>
                              {payable.sourceLabel} · {payable.recurrence !== "none"
                                ? `${payablesContent.list.recurring} · ${payablesContent.recurrences[payable.recurrence]}`
                                : payablesContent.valueTypes[payable.valueType]}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td>
                        <span className="commitment-date-cell"><CalendarIcon /> {formatShortDate(payable.dueDate)}</span>
                      </td>
                      <td>{payable.category}</td>
                      <td>{accountName(accounts, payable.accountId)}</td>
                      <td>
                        <span className={`commitment-status-badge ${payable.status}`}>
                          {payablesContent.statuses[payable.status]}
                        </span>
                      </td>
                      <td>
                        <div className="commitment-value-cell">
                          <strong>{formatCurrency(remaining)}</strong>
                          {payable.paidAmount > 0 && payable.status !== "paid" ? (
                            <span>{payablesContent.list.paidAmount}: {formatCurrency(payable.paidAmount)}</span>
                          ) : null}
                        </div>
                      </td>
                      <td>
                        <button
                          className={`commitment-row-action ${payable.status === "paid" ? "completed" : ""}`}
                          type="button"
                          disabled={payable.status === "paid"}
                          onClick={() => onPay(payable.id)}
                        >
                          {payable.status === "paid" ? <CheckIcon /> : <WalletIcon />}
                          <span>{payable.status === "paid" ? payablesContent.list.paidAction : payablesContent.list.payAction}</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="commitment-mobile-list">
            {payables.map((payable) => {
              const remaining = Math.max(0, payable.amount - payable.paidAmount);

              return (
                <article className="commitment-mobile-card" key={payable.id}>
                  <header>
                    <span className="commitment-row-icon"><BillsIcon /></span>
                    <div>
                      <strong>{payable.description}</strong>
                      <span>{payable.category} · {payable.sourceLabel}</span>
                    </div>
                    <span className={`commitment-status-badge ${payable.status}`}>
                      {payablesContent.statuses[payable.status]}
                    </span>
                  </header>

                  <div className="commitment-mobile-values">
                    <div>
                      <span>{payablesContent.list.remaining}</span>
                      <strong>{formatCurrency(remaining)}</strong>
                    </div>
                    <div>
                      <span>Valor total</span>
                      <strong>{formatCurrency(payable.amount)}</strong>
                    </div>
                  </div>

                  <div className="commitment-mobile-meta">
                    <span><CalendarIcon /> {formatShortDate(payable.dueDate)}</span>
                    <span><WalletIcon /> {accountName(accounts, payable.accountId)}</span>
                    <span className="smart-source-badge">
                      {payable.generated ? financialIntelligenceContent.recurring.automatic : payable.sourceLabel}
                    </span>
                    {payable.recurrence !== "none" ? (
                      <span><ClockIcon /> {payablesContent.recurrences[payable.recurrence]}</span>
                    ) : null}
                  </div>

                  <button
                    className={`commitment-mobile-action ${payable.status === "paid" ? "completed" : ""}`}
                    type="button"
                    disabled={payable.status === "paid"}
                    onClick={() => onPay(payable.id)}
                  >
                    {payable.status === "paid" ? <CheckIcon /> : <WalletIcon />}
                    {payable.status === "paid" ? payablesContent.list.paidAction : payablesContent.list.payAction}
                  </button>
                </article>
              );
            })}
          </div>
        </>
      )}
    </section>
  );
}
