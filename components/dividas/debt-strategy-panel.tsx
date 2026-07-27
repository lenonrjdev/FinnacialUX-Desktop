import { useMemo, useState } from "react";
import { TargetIcon } from "@/components/shared/icons";
import { debtsContent } from "@/content/dividas";
import { formatCurrency, formatPercentage } from "@/lib/formatters";
import type { DebtRow, DebtStrategy } from "@/types/dividas";

export function DebtStrategyPanel({ debts, onSelect }: { debts: DebtRow[]; onSelect: (id: string) => void }) {
  const [strategy, setStrategy] = useState<DebtStrategy>("avalanche");
  const ordered = useMemo(() => debts
    .filter((debt) => debt.computedStatus !== "paid")
    .sort((a, b) => strategy === "avalanche"
      ? b.annualInterestRate - a.annualInterestRate || a.currentBalance - b.currentBalance
      : a.currentBalance - b.currentBalance || b.annualInterestRate - a.annualInterestRate), [debts, strategy]);

  return (
    <aside className="debt-strategy-panel">
      <header>
        <span className="debt-strategy-icon"><TargetIcon /></span>
        <div><span className="section-eyebrow">{debtsContent.strategy.eyebrow}</span><h2>{debtsContent.strategy.title}</h2></div>
      </header>

      <div className="debt-strategy-tabs">
        <button className={strategy === "avalanche" ? "active" : ""} type="button" onClick={() => setStrategy("avalanche")}>{debtsContent.strategy.avalanche}</button>
        <button className={strategy === "snowball" ? "active" : ""} type="button" onClick={() => setStrategy("snowball")}>{debtsContent.strategy.snowball}</button>
      </div>
      <p>{strategy === "avalanche" ? debtsContent.strategy.avalancheDescription : debtsContent.strategy.snowballDescription}</p>

      <div className="debt-strategy-list">
        {ordered.slice(0, 4).map((debt, index) => (
          <button type="button" key={debt.id} onClick={() => onSelect(debt.id)}>
            <span>{index + 1}</span>
            <div><strong>{debt.name}</strong><small>{formatPercentage(debt.annualInterestRate)} {debtsContent.strategy.annualRate}</small></div>
            <b>{formatCurrency(debt.currentBalance)}</b>
          </button>
        ))}
      </div>
    </aside>
  );
}
