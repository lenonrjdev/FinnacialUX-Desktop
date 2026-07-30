import { ReportsIcon, ShieldIcon, WalletIcon, WarningIcon } from "@/components/shared/icons";
import { intelligenceContent } from "@/content/intelligence";
import { formatCurrency, formatPercentage } from "@/lib/formatters";
import type { IntelligenceProjectionSummary } from "@/types/financial-intelligence";

export function IntelligenceSummary({ summary }: { summary: IntelligenceProjectionSummary }) {
  const cards = [
    { key: "start", label: intelligenceContent.summary.startingBalance, value: formatCurrency(summary.startingBalance), icon: <WalletIcon />, featured: true },
    { key: "end", label: intelligenceContent.summary.endingBalance, value: formatCurrency(summary.endingBalance), icon: <ReportsIcon />, alert: summary.endingBalance < 0 },
    { key: "lowest", label: intelligenceContent.summary.lowestBalance, value: formatCurrency(summary.lowestBalance), icon: <WarningIcon />, alert: summary.lowestBalance < 0 },
    { key: "result", label: intelligenceContent.summary.result, value: formatCurrency(summary.projectedResult), icon: <ReportsIcon />, alert: summary.projectedResult < 0 },
    { key: "confidence", label: intelligenceContent.summary.confidence, value: formatPercentage(summary.confidence * 100), icon: <ShieldIcon /> },
    { key: "fixed", label: intelligenceContent.summary.fixedRate, value: formatPercentage(summary.fixedCommitmentRate), icon: <WalletIcon />, alert: summary.fixedCommitmentRate > 80 },
  ];

  return (
    <section className="intelligence-summary-grid" aria-label="Resumo da inteligência financeira">
      {cards.map((card) => (
        <article
          className={`projection-summary-card intelligence-summary-card ${card.featured ? "featured" : ""} ${card.alert ? "alert" : ""}`}
          key={card.key}
        >
          <span className="projection-summary-icon">{card.icon}</span>
          <span>{card.label}</span>
          <strong>{card.value}</strong>
        </article>
      ))}
    </section>
  );
}
