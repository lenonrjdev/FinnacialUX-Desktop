import { BillsIcon } from "@/components/shared/icons";
import { OverviewIcon } from "@/components/visao-geral/overview-icon";
import { overviewContent } from "@/content/visao-geral";
import type { FinancialOverviewData } from "@/lib/use-financial-overview";
import { formatCurrency, formatSignedCurrency } from "@/lib/formatters";

export function FinancialLists({ data }: { data: FinancialOverviewData }) {
  return (
    <section className="overview-lists-grid">
      <article className="finance-card list-card">
        <header className="card-header list-card-header">
          <div>
            <span className="card-kicker">{overviewContent.bills.kicker}</span>
            <h2>{overviewContent.bills.title}</h2>
          </div>
          <button type="button" className="text-button">
            {overviewContent.bills.action}
          </button>
        </header>

        <div className="item-list">
          {data.bills.length === 0 ? (
            <div className="overview-empty-state">Nenhuma conta a pagar cadastrada.</div>
          ) : null}
          {data.bills.map((bill) => (
            <div className="list-item bill-item" key={bill.id}>
              <span className="list-icon" aria-hidden="true"><BillsIcon /></span>
              <div className="list-copy">
                <strong>{bill.title}</strong>
                <span>{overviewContent.bills.duePrefix} {bill.date}</span>
              </div>
              <div className="list-value">
                <strong>{formatCurrency(bill.value)}</strong>
                <span>{bill.status}</span>
              </div>
            </div>
          ))}
        </div>
      </article>

      <article className="finance-card list-card">
        <header className="card-header list-card-header">
          <div>
            <span className="card-kicker">{overviewContent.transactions.kicker}</span>
            <h2>{overviewContent.transactions.title}</h2>
          </div>
          <button type="button" className="text-button">
            {overviewContent.transactions.action}
          </button>
        </header>

        <div className="item-list">
          {data.transactions.length === 0 ? (
            <div className="overview-empty-state">Nenhum lançamento registrado.</div>
          ) : null}
          {data.transactions.map((transaction) => (
            <div className="list-item transaction-item" key={transaction.id}>
              <span className="list-icon" aria-hidden="true">
                <OverviewIcon name={transaction.icon} />
              </span>
              <div className="list-copy">
                <strong>{transaction.title}</strong>
                <span>{transaction.category} · {transaction.date}</span>
              </div>
              <div className={`transaction-value ${transaction.kind}`}>
                <strong>{formatSignedCurrency(transaction.value)}</strong>
                <span>{overviewContent.transactions.completedStatus}</span>
              </div>
            </div>
          ))}
        </div>
      </article>
    </section>
  );
}
