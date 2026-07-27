import {
  BillsIcon,
  IncomeIcon,
  ReportsIcon,
  TransactionsIcon,
} from "@/components/shared/icons";
import { transactionsContent } from "@/content/lancamentos";
import { formatCurrency, formatSignedCurrency } from "@/lib/formatters";

type SummaryValues = {
  income: number;
  expense: number;
  result: number;
  pending: number;
  pendingCount: number;
};

const iconByCard = {
  income: IncomeIcon,
  expense: TransactionsIcon,
  result: ReportsIcon,
  pending: BillsIcon,
};

export function TransactionsSummary({ values }: { values: SummaryValues }) {
  return (
    <section
      className="transactions-summary-grid"
      aria-label={transactionsContent.summary.ariaLabel}
    >
      {transactionsContent.summary.cards.map((card) => {
        const Icon = iconByCard[card.id];
        const isResult = card.id === "result";
        const value =
          card.id === "pending"
            ? values.pending
            : values[card.id as "income" | "expense" | "result"];

        return (
          <article
            className={`transaction-summary-card ${card.id === "income" ? "featured" : ""}`}
            key={card.id}
          >
            <div className="transaction-summary-card-top">
              <span className="transaction-summary-icon">
                <Icon />
              </span>
              {card.id === "pending" && (
                <span className="pending-count">{values.pendingCount}</span>
              )}
            </div>
            <span>{card.label}</span>
            <strong>
              {isResult ? formatSignedCurrency(value) : formatCurrency(value)}
            </strong>
            <small>{card.helper}</small>
          </article>
        );
      })}
    </section>
  );
}
