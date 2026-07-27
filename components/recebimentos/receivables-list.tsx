import {
  CalendarIcon,
  CheckIcon,
  ClockIcon,
  IncomeIcon,
  WalletIcon,
} from "@/components/shared/icons";
import { receivablesContent } from "@/content/recebimentos";
import { formatCurrency, formatShortDate } from "@/lib/formatters";
import type { FinancialAccount } from "@/types/contas";
import type { Receivable } from "@/types/recebimentos";

type ReceivablesListProps = {
  receivables: Receivable[];
  accounts: FinancialAccount[];
  onReceive: (receivableId: string) => void;
};

function accountName(accounts: FinancialAccount[], id: string): string {
  return accounts.find((account) => account.id === id)?.name ?? "Conta não encontrada";
}

export function ReceivablesList({
  receivables,
  accounts,
  onReceive,
}: ReceivablesListProps) {
  return (
    <section className="commitment-list-card receivables-list-card">
      <header className="commitment-list-header">
        <div>
          <span className="section-eyebrow">{receivablesContent.list.kicker}</span>
          <h2>{receivablesContent.list.title}</h2>
        </div>
        <span>{receivables.length} {receivablesContent.list.countSuffix}</span>
      </header>

      {receivables.length === 0 ? (
        <div className="commitment-empty-state">
          <span className="commitment-empty-icon"><IncomeIcon /></span>
          <strong>{receivablesContent.list.emptyTitle}</strong>
          <p>{receivablesContent.list.emptyDescription}</p>
        </div>
      ) : (
        <>
          <div className="commitment-table-wrap">
            <table className="commitment-table">
              <thead>
                <tr>
                  <th>{receivablesContent.list.columns.description}</th>
                  <th>{receivablesContent.list.columns.expectedDate}</th>
                  <th>{receivablesContent.list.columns.source}</th>
                  <th>{receivablesContent.list.columns.account}</th>
                  <th>{receivablesContent.list.columns.status}</th>
                  <th>{receivablesContent.list.columns.remaining}</th>
                  <th><span className="sr-only">{receivablesContent.list.columns.actions}</span></th>
                </tr>
              </thead>
              <tbody>
                {receivables.map((receivable) => {
                  const remaining = Math.max(0, receivable.amount - receivable.receivedAmount);

                  return (
                    <tr key={receivable.id}>
                      <td>
                        <div className="commitment-description-cell">
                          <span className="commitment-row-icon income"><IncomeIcon /></span>
                          <div>
                            <strong>{receivable.description}</strong>
                            <span>
                              {receivable.payer || receivable.category}
                              {receivable.recurrence !== "none" ? ` · ${receivablesContent.list.recurring}` : ""}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td>
                        <span className="commitment-date-cell"><CalendarIcon /> {formatShortDate(receivable.expectedDate)}</span>
                      </td>
                      <td>{receivable.source}</td>
                      <td>{accountName(accounts, receivable.accountId)}</td>
                      <td>
                        <span className={`commitment-status-badge ${receivable.status}`}>
                          {receivablesContent.statuses[receivable.status]}
                        </span>
                      </td>
                      <td>
                        <div className="commitment-value-cell income">
                          <strong>{formatCurrency(remaining)}</strong>
                          {receivable.receivedAmount > 0 && receivable.status !== "received" ? (
                            <span>{receivablesContent.list.receivedAmount}: {formatCurrency(receivable.receivedAmount)}</span>
                          ) : null}
                        </div>
                      </td>
                      <td>
                        <button
                          className={`commitment-row-action income ${receivable.status === "received" ? "completed" : ""}`}
                          type="button"
                          disabled={receivable.status === "received"}
                          onClick={() => onReceive(receivable.id)}
                        >
                          {receivable.status === "received" ? <CheckIcon /> : <IncomeIcon />}
                          <span>{receivable.status === "received" ? receivablesContent.list.receivedAction : receivablesContent.list.receiveAction}</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="commitment-mobile-list">
            {receivables.map((receivable) => {
              const remaining = Math.max(0, receivable.amount - receivable.receivedAmount);

              return (
                <article className="commitment-mobile-card" key={receivable.id}>
                  <header>
                    <span className="commitment-row-icon income"><IncomeIcon /></span>
                    <div>
                      <strong>{receivable.description}</strong>
                      <span>{receivable.source}</span>
                    </div>
                    <span className={`commitment-status-badge ${receivable.status}`}>
                      {receivablesContent.statuses[receivable.status]}
                    </span>
                  </header>

                  <div className="commitment-mobile-values">
                    <div>
                      <span>{receivablesContent.list.remaining}</span>
                      <strong>{formatCurrency(remaining)}</strong>
                    </div>
                    <div>
                      <span>Valor esperado</span>
                      <strong>{formatCurrency(receivable.amount)}</strong>
                    </div>
                  </div>

                  <div className="commitment-mobile-meta">
                    <span><CalendarIcon /> {formatShortDate(receivable.expectedDate)}</span>
                    <span><WalletIcon /> {accountName(accounts, receivable.accountId)}</span>
                    {receivable.recurrence !== "none" ? (
                      <span><ClockIcon /> {receivablesContent.recurrences[receivable.recurrence]}</span>
                    ) : null}
                  </div>

                  <button
                    className={`commitment-mobile-action income ${receivable.status === "received" ? "completed" : ""}`}
                    type="button"
                    disabled={receivable.status === "received"}
                    onClick={() => onReceive(receivable.id)}
                  >
                    {receivable.status === "received" ? <CheckIcon /> : <IncomeIcon />}
                    {receivable.status === "received" ? receivablesContent.list.receivedAction : receivablesContent.list.receiveAction}
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
