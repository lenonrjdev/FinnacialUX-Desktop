"use client";

import { useState } from "react";
import { CopyIcon, MoreIcon, TrashIcon } from "@/components/shared/icons";
import { TransactionTypeIcon } from "@/components/lancamentos/transaction-type-icon";
import { transactionsContent } from "@/content/lancamentos";
import {
  formatCurrency,
  formatShortDate,
  formatSignedCurrency,
} from "@/lib/formatters";
import type { FinancialTransaction } from "@/types/lancamentos";

function transactionValue(transaction: FinancialTransaction) {
  if (transaction.type === "income") {
    return formatSignedCurrency(transaction.amount);
  }

  if (transaction.type === "expense") {
    return formatSignedCurrency(-transaction.amount);
  }

  return formatCurrency(transaction.amount);
}

export function TransactionsList({
  transactions,
  onDuplicate,
  onDelete,
}: {
  transactions: FinancialTransaction[];
  onDuplicate: (transaction: FinancialTransaction) => void;
  onDelete: (transactionId: string) => void;
}) {
  const [activeMenu, setActiveMenu] = useState<string | null>(null);

  function transactionActions(transaction: FinancialTransaction) {
    return (
      <div className="transaction-actions-menu">
        <button
          type="button"
          onClick={() => {
            onDuplicate(transaction);
            setActiveMenu(null);
          }}
        >
          <CopyIcon />
          {transactionsContent.list.actions.duplicate}
        </button>
        <button
          className="danger"
          type="button"
          onClick={() => {
            onDelete(transaction.id);
            setActiveMenu(null);
          }}
        >
          <TrashIcon />
          {transactionsContent.list.actions.delete}
        </button>
      </div>
    );
  }

  return (
    <section className="transactions-list-card">
      <header className="transactions-list-header">
        <div>
          <span className="card-kicker">{transactionsContent.list.kicker}</span>
          <h2>{transactionsContent.list.title}</h2>
        </div>
        <span className="transactions-count">
          {transactions.length} {transactionsContent.list.countSuffix}
        </span>
      </header>

      {transactions.length === 0 ? (
        <div className="transactions-empty-state">
          <TransactionsListEmptyIcon />
          <strong>{transactionsContent.list.emptyTitle}</strong>
          <p>{transactionsContent.list.emptyDescription}</p>
        </div>
      ) : (
        <>
          <div className="transactions-table-wrap">
            <table className="transactions-table">
              <thead>
                <tr>
                  <th>{transactionsContent.list.columns.description}</th>
                  <th>{transactionsContent.list.columns.date}</th>
                  <th>{transactionsContent.list.columns.account}</th>
                  <th>{transactionsContent.list.columns.status}</th>
                  <th>{transactionsContent.list.columns.value}</th>
                  <th aria-label={transactionsContent.list.columns.actions} />
                </tr>
              </thead>
              <tbody>
                {transactions.map((transaction) => (
                  <tr key={transaction.id}>
                    <td>
                      <div className="transaction-description-cell">
                        <TransactionTypeIcon type={transaction.type} />
                        <div>
                          <strong>{transaction.description}</strong>
                          <span>
                            {transaction.category} · {transaction.paymentMethod}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td>{formatShortDate(transaction.date)}</td>
                    <td>
                      <div className="transaction-account-cell">
                        <strong>{transaction.account}</strong>
                        {transaction.destinationAccount && (
                          <span>para {transaction.destinationAccount}</span>
                        )}
                      </div>
                    </td>
                    <td>
                      <span className={`transaction-status ${transaction.status}`}>
                        {transactionsContent.statuses[transaction.status]}
                      </span>
                    </td>
                    <td>
                      <strong className={`transaction-table-value ${transaction.type}`}>
                        {transactionValue(transaction)}
                      </strong>
                    </td>
                    <td>
                      <div className="transaction-actions">
                        <button
                          className="more-button"
                          type="button"
                          aria-label={`${transactionsContent.list.actions.morePrefix} ${transaction.description}`}
                          aria-expanded={activeMenu === transaction.id}
                          onClick={() =>
                            setActiveMenu((current) =>
                              current === transaction.id ? null : transaction.id,
                            )
                          }
                        >
                          <MoreIcon />
                        </button>
                        {activeMenu === transaction.id && transactionActions(transaction)}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="transactions-mobile-list">
            {transactions.map((transaction) => (
              <article className="transaction-mobile-card" key={transaction.id}>
                <div className="transaction-mobile-card-top">
                  <TransactionTypeIcon type={transaction.type} />
                  <div className="transaction-mobile-copy">
                    <strong>{transaction.description}</strong>
                    <span>
                      {transaction.category}{" "}
                      {transactionsContent.list.mobileDetailsSeparator}{" "}
                      {formatShortDate(transaction.date)}
                    </span>
                  </div>
                  <strong className={`transaction-table-value ${transaction.type}`}>
                    {transactionValue(transaction)}
                  </strong>
                </div>
                <div className="transaction-mobile-meta">
                  <span>{transaction.account}</span>
                  <div>
                    <span className={`transaction-status ${transaction.status}`}>
                      {transactionsContent.statuses[transaction.status]}
                    </span>
                    <div className="transaction-actions">
                      <button
                        className="more-button"
                        type="button"
                        aria-label={`${transactionsContent.list.actions.morePrefix} ${transaction.description}`}
                        onClick={() =>
                          setActiveMenu((current) =>
                            current === transaction.id ? null : transaction.id,
                          )
                        }
                      >
                        <MoreIcon />
                      </button>
                      {activeMenu === transaction.id && transactionActions(transaction)}
                    </div>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </>
      )}
    </section>
  );
}

function TransactionsListEmptyIcon() {
  return (
    <span className="transactions-empty-icon" aria-hidden="true">
      <span />
      <span />
      <span />
    </span>
  );
}
