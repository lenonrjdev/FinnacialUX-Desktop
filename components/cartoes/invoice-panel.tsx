import {
  CalendarIcon,
  CheckIcon,
  CreditCardIcon,
  ReceiptIcon,
} from "@/components/shared/icons";
import { cardsContent } from "@/content/cartoes";
import { formatCurrency, formatShortDate } from "@/lib/formatters";
import type { CardInvoice, CardPurchase, CreditCard } from "@/types/cartoes";

export function InvoicePanel({
  card,
  invoices,
  selectedInvoiceId,
  purchases,
  onInvoiceSelect,
  onPay,
}: {
  card?: CreditCard;
  invoices: CardInvoice[];
  selectedInvoiceId: string;
  purchases: CardPurchase[];
  onInvoiceSelect: (invoiceId: string) => void;
  onPay: (invoiceId: string) => void;
}) {
  const selectedInvoice = invoices.find((invoice) => invoice.id === selectedInvoiceId);
  const invoicePurchases = purchases
    .filter((purchase) => purchase.invoiceId === selectedInvoiceId)
    .sort((a, b) => b.date.localeCompare(a.date));

  if (!card || !selectedInvoice) return null;

  return (
    <section className="invoice-panel">
      <header className="invoice-panel-heading">
        <div>
          <span>{cardsContent.invoice.kicker}</span>
          <h2>{cardsContent.invoice.title}</h2>
          <p>{card.institution} •••• {card.lastFourDigits}</p>
        </div>
        <div className="invoice-period-tabs" aria-label="Selecionar fatura">
          {invoices.map((invoice) => (
            <button
              type="button"
              className={invoice.id === selectedInvoiceId ? "active" : ""}
              onClick={() => onInvoiceSelect(invoice.id)}
              key={invoice.id}
            >
              <span>{invoice.referenceLabel.replace(" de 2026", "")}</span>
              <small>{cardsContent.invoice.statuses[invoice.status]}</small>
            </button>
          ))}
        </div>
      </header>

      <div className="invoice-summary-strip">
        <div className="invoice-total-block">
          <span>{cardsContent.invoice.total}</span>
          <strong>{formatCurrency(selectedInvoice.amount)}</strong>
          <small className={`invoice-status ${selectedInvoice.status}`}>
            {selectedInvoice.status === "paid" && <CheckIcon />}
            {cardsContent.invoice.statuses[selectedInvoice.status]}
          </small>
        </div>

        <div className="invoice-date-block">
          <span><CalendarIcon /> {cardsContent.invoice.closingDate}</span>
          <strong>{formatShortDate(selectedInvoice.closingDate)}</strong>
        </div>
        <div className="invoice-date-block">
          <span><CalendarIcon /> {cardsContent.invoice.dueDate}</span>
          <strong>{formatShortDate(selectedInvoice.dueDate)}</strong>
        </div>

        <button
          className={`invoice-pay-button ${selectedInvoice.status === "paid" ? "paid" : ""}`}
          type="button"
          disabled={selectedInvoice.status === "paid"}
          onClick={() => onPay(selectedInvoice.id)}
        >
          {selectedInvoice.status === "paid" ? <CheckIcon /> : <ReceiptIcon />}
          {selectedInvoice.status === "paid"
            ? cardsContent.invoice.paidAction
            : cardsContent.invoice.payAction}
        </button>
      </div>

      <div className="invoice-purchases-heading">
        <div>
          <span>{cardsContent.invoice.purchasesTitle}</span>
          <small>{invoicePurchases.length} {cardsContent.invoice.purchaseCountSuffix}</small>
        </div>
      </div>

      {invoicePurchases.length ? (
        <div className="invoice-purchases-list">
          {invoicePurchases.map((purchase) => (
            <article className="invoice-purchase-item" key={purchase.id}>
              <span className="invoice-purchase-icon"><CreditCardIcon /></span>
              <div className="invoice-purchase-copy">
                <strong>{purchase.description}</strong>
                <span>{purchase.category} · {formatShortDate(purchase.date)}</span>
              </div>
              <div className="invoice-purchase-installment">
                <span>
                  {purchase.installments > 1
                    ? `${cardsContent.invoice.installmentLabel} ${purchase.currentInstallment}/${purchase.installments}`
                    : cardsContent.invoice.singlePurchase}
                </span>
                {purchase.installments > 1 && (
                  <small>{formatCurrency(purchase.totalAmount)} no total</small>
                )}
              </div>
              <strong className="invoice-purchase-value">
                {formatCurrency(purchase.installmentAmount)}
              </strong>
            </article>
          ))}
        </div>
      ) : (
        <div className="invoice-empty-state">
          <span><ReceiptIcon /></span>
          <strong>{cardsContent.invoice.noPurchasesTitle}</strong>
          <p>{cardsContent.invoice.noPurchasesDescription}</p>
        </div>
      )}
    </section>
  );
}
