import { ReceiptIcon } from "@/components/shared/icons";
import { debtsContent } from "@/content/dividas";
import { formatCurrency, formatShortDate } from "@/lib/formatters";
import type { DebtPayment, DebtRow } from "@/types/dividas";

export function DebtPaymentsList({
  payments,
  debts,
  accountNames,
}: {
  payments: DebtPayment[];
  debts: DebtRow[];
  accountNames: Record<string, string>;
}) {
  const debtNames = Object.fromEntries(debts.map((debt) => [debt.id, debt.name]));

  return (
    <section className="debt-payments-card">
      <header className="debt-payments-header">
        <div><span className="section-eyebrow">{debtsContent.payments.eyebrow}</span><h2>{debtsContent.payments.title}</h2></div>
        <span>{payments.length} {payments.length === 1 ? debtsContent.payments.resultSingular : debtsContent.payments.resultPlural}</span>
      </header>

      {payments.length ? (
        <div className="debt-payments-table-wrap">
          <table className="debt-payments-table">
            <thead><tr><th>{debtsContent.payments.date}</th><th>{debtsContent.payments.debt}</th><th>{debtsContent.payments.account}</th><th>{debtsContent.payments.principal}</th><th>{debtsContent.payments.interest}</th><th>{debtsContent.payments.amount}</th></tr></thead>
            <tbody>
              {payments.map((payment) => (
                <tr key={payment.id}>
                  <td>{formatShortDate(payment.date)}</td>
                  <td><strong>{debtNames[payment.debtId] ?? debtsContent.payments.removedDebt}</strong><small>{payment.note}</small></td>
                  <td>{accountNames[payment.accountId] ?? debtsContent.list.unknownAccount}</td>
                  <td>{formatCurrency(payment.principal)}</td>
                  <td>{formatCurrency(payment.interest)}</td>
                  <td className="debt-payment-total">{formatCurrency(payment.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="debts-empty-state"><span><ReceiptIcon /></span><strong>{debtsContent.payments.emptyTitle}</strong><p>{debtsContent.payments.emptyDescription}</p></div>
      )}
    </section>
  );
}
