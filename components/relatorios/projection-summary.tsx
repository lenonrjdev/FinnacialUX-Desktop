import { CalendarIcon, ReportsIcon, WalletIcon } from "@/components/shared/icons";
import { reportsContent } from "@/content/relatorios";
import { formatCurrency } from "@/lib/formatters";

export function ProjectionSummary({
  startingBalance,
  endingBalance,
  totalIncome,
  totalExpenses,
  lowestBalance,
}: {
  startingBalance: number;
  endingBalance: number;
  totalIncome: number;
  totalExpenses: number;
  lowestBalance: number;
}) {
  const cards = [
    { key: "start", label: reportsContent.projection.startingBalance, value: formatCurrency(startingBalance), icon: <WalletIcon />, featured: true },
    { key: "end", label: reportsContent.projection.endingBalance, value: formatCurrency(endingBalance), icon: <ReportsIcon />, alert: endingBalance < 0 },
    { key: "income", label: reportsContent.projection.totalIncome, value: formatCurrency(totalIncome), icon: <CalendarIcon /> },
    { key: "expenses", label: reportsContent.projection.totalExpenses, value: formatCurrency(totalExpenses), icon: <CalendarIcon /> },
    { key: "lowest", label: reportsContent.projection.lowestBalance, value: formatCurrency(lowestBalance), icon: <WalletIcon />, alert: lowestBalance < 0 },
  ];

  return (
    <section className="projection-summary-grid">
      {cards.map((card) => (
        <article className={`projection-summary-card ${card.featured ? "featured" : ""} ${card.alert ? "alert" : ""}`} key={card.key}>
          <span className="projection-summary-icon">{card.icon}</span>
          <span>{card.label}</span>
          <strong>{card.value}</strong>
        </article>
      ))}
    </section>
  );
}
