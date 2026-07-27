import { useMemo, useState } from "react";
import { BudgetIcon } from "@/components/shared/icons";
import { debtsContent } from "@/content/dividas";
import { formatCurrency } from "@/lib/formatters";
import type { DebtRow, PayoffSimulation } from "@/types/dividas";

function calculateMonths(balance: number, monthlyRate: number, payment: number): number {
  if (balance <= 0) return 0;
  if (payment <= 0) return Number.POSITIVE_INFINITY;
  if (monthlyRate <= 0) return Math.ceil(balance / payment);
  if (payment <= balance * monthlyRate) return Number.POSITIVE_INFINITY;
  return Math.ceil(-Math.log(1 - (monthlyRate * balance) / payment) / Math.log(1 + monthlyRate));
}

function simulate(debt: DebtRow, extra: number): PayoffSimulation {
  const currentMonths = Math.max(debt.remainingInstallments, 0);
  const currentInterest = Math.max(debt.installmentAmount * currentMonths - debt.currentBalance, 0);
  const newMonthlyPayment = debt.installmentAmount + Math.max(extra, 0);
  const monthlyRate = debt.annualInterestRate / 1200;
  const calculatedMonths = calculateMonths(debt.currentBalance, monthlyRate, newMonthlyPayment);
  const simulatedMonths = Number.isFinite(calculatedMonths) ? Math.max(calculatedMonths, 1) : currentMonths;
  const simulatedInterest = Math.max(newMonthlyPayment * simulatedMonths - debt.currentBalance, 0);

  return {
    currentMonths,
    simulatedMonths,
    monthsSaved: Math.max(currentMonths - simulatedMonths, 0),
    currentInterest,
    simulatedInterest,
    interestSaved: Math.max(currentInterest - simulatedInterest, 0),
    newMonthlyPayment,
  };
}

export function PayoffSimulator({ debts, selectedId, onSelect }: { debts: DebtRow[]; selectedId: string; onSelect: (id: string) => void }) {
  const [extra, setExtra] = useState(200);
  const debt = debts.find((item) => item.id === selectedId) ?? debts[0];
  const result = useMemo(() => debt ? simulate(debt, extra) : null, [debt, extra]);

  if (!debt || !result) return null;

  return (
    <aside className="payoff-simulator-panel">
      <header>
        <span className="payoff-panel-icon"><BudgetIcon /></span>
        <div>
          <span className="section-eyebrow">{debtsContent.simulator.eyebrow}</span>
          <h2>{debtsContent.simulator.title}</h2>
        </div>
      </header>
      <p>{debtsContent.simulator.description}</p>

      <label className="form-field">
        <span>{debtsContent.simulator.selectDebt}</span>
        <select value={debt.id} onChange={(event) => onSelect(event.target.value)}>
          {debts.filter((item) => item.computedStatus !== "paid").map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select>
      </label>

      <label className="form-field">
        <span>{debtsContent.simulator.extraPayment}</span>
        <div className="currency-input"><b>R$</b><input type="number" min="0" step="50" value={extra} onChange={(event) => setExtra(Number(event.target.value))} /></div>
      </label>

      <div className="payoff-plan-comparison">
        <div><span>{debtsContent.simulator.currentPlan}</span><strong>{result.currentMonths} {debtsContent.simulator.months}</strong></div>
        <div className="new"><span>{debtsContent.simulator.newPlan}</span><strong>{result.simulatedMonths} {debtsContent.simulator.months}</strong></div>
      </div>

      <div className="payoff-results-grid">
        <div><span>{debtsContent.simulator.monthsSaved}</span><strong>{result.monthsSaved}</strong></div>
        <div><span>{debtsContent.simulator.interestSaved}</span><strong>{formatCurrency(result.interestSaved)}</strong></div>
        <div className="wide"><span>{debtsContent.simulator.newMonthly}</span><strong>{formatCurrency(result.newMonthlyPayment)}</strong></div>
      </div>

      {result.monthsSaved === 0 ? <small className="payoff-no-savings">{debtsContent.simulator.noSavings}</small> : null}
    </aside>
  );
}
