import {
  ClockIcon,
  CreditCardIcon,
  ReceiptIcon,
  WalletIcon,
} from "@/components/shared/icons";
import { cardsContent } from "@/content/cartoes";
import { formatCurrency, formatPercentage } from "@/lib/formatters";

export type CardsSummaryValues = {
  totalLimit: number;
  usedLimit: number;
  availableLimit: number;
  openInvoices: number;
  futureInstallments: number;
};

export function CardsSummary({ values }: { values: CardsSummaryValues }) {
  const usage = values.totalLimit
    ? Math.min(100, (values.usedLimit / values.totalLimit) * 100)
    : 0;

  return (
    <section className="cards-summary-grid" aria-label="Resumo dos cartões">
      <article className="cards-limit-card">
        <div className="cards-limit-topline">
          <span className="cards-limit-icon"><CreditCardIcon /></span>
          <span>{cardsContent.summary.totalLimitHelper}</span>
        </div>
        <span className="cards-limit-label">{cardsContent.summary.totalLimit}</span>
        <strong>{formatCurrency(values.totalLimit)}</strong>
        <div className="cards-limit-progress-copy">
          <span>{cardsContent.summary.usageLabel}</span>
          <b>{formatPercentage(usage)}</b>
        </div>
        <div className="cards-limit-track" aria-hidden="true">
          <span style={{ width: `${usage}%` }} />
        </div>
      </article>

      <article className="card-summary-card">
        <span className="card-summary-icon"><WalletIcon /></span>
        <span>{cardsContent.summary.availableLimit}</span>
        <strong>{formatCurrency(values.availableLimit)}</strong>
        <small>{cardsContent.summary.availableLimitHelper}</small>
      </article>

      <article className="card-summary-card">
        <span className="card-summary-icon"><ReceiptIcon /></span>
        <span>{cardsContent.summary.openInvoices}</span>
        <strong>{formatCurrency(values.openInvoices)}</strong>
        <small>{cardsContent.summary.openInvoicesHelper}</small>
      </article>

      <article className="card-summary-card">
        <span className="card-summary-icon"><ClockIcon /></span>
        <span>{cardsContent.summary.futureInstallments}</span>
        <strong>{formatCurrency(values.futureInstallments)}</strong>
        <small>{cardsContent.summary.futureInstallmentsHelper}</small>
      </article>
    </section>
  );
}
