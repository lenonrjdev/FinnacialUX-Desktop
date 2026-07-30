"use client";

import { RefreshIcon } from "@/components/shared/icons";
import { intelligenceContent } from "@/content/intelligence";
import type { IntelligenceScenarioAssumptions } from "@/types/financial-intelligence";
import { defaultIntelligenceAssumptions } from "@/types/financial-intelligence";

function numberValue(value: string): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function IntelligenceSimulator({
  assumptions,
  onChange,
}: {
  assumptions: IntelligenceScenarioAssumptions;
  onChange: (assumptions: IntelligenceScenarioAssumptions) => void;
}) {
  function patch(values: Partial<IntelligenceScenarioAssumptions>) {
    onChange({ ...assumptions, ...values });
  }

  return (
    <article className="report-panel intelligence-simulator-panel">
      <header className="report-panel-header intelligence-panel-header-with-action">
        <div>
          <h2>{intelligenceContent.simulator.title}</h2>
          <p>{intelligenceContent.simulator.description}</p>
        </div>
        <button type="button" className="secondary-action-button" onClick={() => onChange({ ...defaultIntelligenceAssumptions })}>
          <RefreshIcon />
          {intelligenceContent.simulator.reset}
        </button>
      </header>

      <div className="intelligence-simulator-grid">
        <label>
          <span>{intelligenceContent.simulator.incomeAdjustment}</span>
          <input
            type="number"
            min="-90"
            max="300"
            step="1"
            value={assumptions.incomeAdjustmentPercent}
            onChange={(event) => patch({ incomeAdjustmentPercent: numberValue(event.target.value) })}
          />
        </label>
        <label>
          <span>{intelligenceContent.simulator.fixedExpenseAdjustment}</span>
          <input
            type="number"
            min="-90"
            max="300"
            step="1"
            value={assumptions.fixedExpenseAdjustmentPercent}
            onChange={(event) => patch({ fixedExpenseAdjustmentPercent: numberValue(event.target.value) })}
          />
        </label>
        <label>
          <span>{intelligenceContent.simulator.variableExpenseAdjustment}</span>
          <input
            type="number"
            min="-90"
            max="300"
            step="1"
            value={assumptions.variableExpenseAdjustmentPercent}
            onChange={(event) => patch({ variableExpenseAdjustmentPercent: numberValue(event.target.value) })}
          />
        </label>
        <label>
          <span>{intelligenceContent.simulator.oneTimeIncome}</span>
          <input
            type="number"
            min="0"
            step="0.01"
            value={assumptions.oneTimeIncome}
            onChange={(event) => patch({ oneTimeIncome: numberValue(event.target.value) })}
          />
        </label>
        <label>
          <span>{intelligenceContent.simulator.oneTimeIncomeDate}</span>
          <input
            type="date"
            value={assumptions.oneTimeIncomeDate ?? ""}
            onChange={(event) => patch({ oneTimeIncomeDate: event.target.value || null })}
          />
        </label>
        <label>
          <span>{intelligenceContent.simulator.oneTimeExpense}</span>
          <input
            type="number"
            min="0"
            step="0.01"
            value={assumptions.oneTimeExpense}
            onChange={(event) => patch({ oneTimeExpense: numberValue(event.target.value) })}
          />
        </label>
        <label>
          <span>{intelligenceContent.simulator.oneTimeExpenseDate}</span>
          <input
            type="date"
            value={assumptions.oneTimeExpenseDate ?? ""}
            onChange={(event) => patch({ oneTimeExpenseDate: event.target.value || null })}
          />
        </label>
        <label>
          <span>{intelligenceContent.simulator.monthlyCommitment}</span>
          <input
            type="number"
            min="0"
            step="0.01"
            value={assumptions.newMonthlyCommitment}
            onChange={(event) => patch({ newMonthlyCommitment: numberValue(event.target.value) })}
          />
        </label>
        <label>
          <span>{intelligenceContent.simulator.commitmentStart}</span>
          <input
            type="date"
            value={assumptions.newCommitmentStartDate ?? ""}
            onChange={(event) => patch({ newCommitmentStartDate: event.target.value || null })}
          />
        </label>
        <label>
          <span>{intelligenceContent.simulator.commitmentMonths}</span>
          <input
            type="number"
            min="1"
            max="120"
            step="1"
            value={assumptions.newCommitmentMonths}
            onChange={(event) => patch({ newCommitmentMonths: Math.max(1, Math.trunc(numberValue(event.target.value))) })}
          />
        </label>
      </div>
    </article>
  );
}
