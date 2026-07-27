import { ShieldIcon, TargetIcon } from "@/components/shared/icons";
import { goalsContent } from "@/content/metas";
import { formatCurrency, formatPercentage } from "@/lib/formatters";
import type { GoalRow } from "@/types/metas";

export function GoalsInsightPanel({
  emergencyGoal,
  essentialMonthlyCost,
  coverageTarget,
  activeGoals,
}: {
  emergencyGoal?: GoalRow;
  essentialMonthlyCost: number;
  coverageTarget: number;
  activeGoals: GoalRow[];
}) {
  const coveredMonths = emergencyGoal ? emergencyGoal.currentAmount / essentialMonthlyCost : 0;
  const coverageProgress = Math.min((coveredMonths / coverageTarget) * 100, 100);
  const attention = coveredMonths < 1;
  const monthlyTotal = activeGoals.reduce((total, goal) => total + goal.monthlyContribution, 0);
  const maxMonthly = Math.max(...activeGoals.map((goal) => goal.monthlyContribution), 1);

  return (
    <aside className="goals-insight-column">
      <section className="goal-emergency-panel">
        <header>
          <span className="goal-insight-icon"><ShieldIcon /></span>
          <div>
            <span className="section-eyebrow">{goalsContent.insight.eyebrow}</span>
            <h2>{goalsContent.insight.title}</h2>
          </div>
        </header>
        <p>{goalsContent.insight.description}</p>

        <div className="goal-emergency-value">
          <span>{goalsContent.insight.current}</span>
          <strong>{formatCurrency(emergencyGoal?.currentAmount ?? 0)}</strong>
          <small>{formatPercentage(emergencyGoal?.progress ?? 0)} {goalsContent.list.current.toLocaleLowerCase("pt-BR")}</small>
        </div>

        <div className="goal-coverage-track">
          <span style={{ width: `${coverageProgress}%` }} />
        </div>

        <div className="goal-emergency-stats">
          <div>
            <span>{goalsContent.insight.essentialCost}</span>
            <strong>{formatCurrency(essentialMonthlyCost)}</strong>
          </div>
          <div>
            <span>{goalsContent.insight.coveredMonths}</span>
            <strong>{coveredMonths.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}</strong>
          </div>
          <div>
            <span>{goalsContent.insight.targetMonths}</span>
            <strong>{coverageTarget}</strong>
          </div>
          <div>
            <span>{goalsContent.insight.target}</span>
            <strong>{formatCurrency(emergencyGoal?.targetAmount ?? essentialMonthlyCost * coverageTarget)}</strong>
          </div>
        </div>

        <div className={`goal-protection-message ${attention ? "attention" : "healthy"}`}>
          <ShieldIcon />
          <div>
            <strong>{attention ? goalsContent.insight.attentionTitle : goalsContent.insight.healthyTitle}</strong>
            <p>{attention ? goalsContent.insight.attentionDescription : goalsContent.insight.healthyDescription}</p>
          </div>
        </div>
      </section>

      <section className="goal-monthly-plan-panel">
        <header>
          <div>
            <h2>{goalsContent.plan.title}</h2>
            <p>{goalsContent.plan.description}</p>
          </div>
          <span><TargetIcon /></span>
        </header>

        <div className="goal-plan-total">
          <span>{goalsContent.plan.total}</span>
          <strong>{formatCurrency(monthlyTotal)}</strong>
          <small>{activeGoals.length} {goalsContent.plan.activeGoals}</small>
        </div>

        {activeGoals.length ? (
          <div className="goal-plan-list">
            {activeGoals
              .filter((goal) => goal.monthlyContribution > 0)
              .sort((a, b) => b.monthlyContribution - a.monthlyContribution)
              .map((goal) => (
                <div key={goal.id}>
                  <div>
                    <span>{goal.name}</span>
                    <strong>{formatCurrency(goal.monthlyContribution)}</strong>
                  </div>
                  <div className="goal-plan-track">
                    <span style={{ width: `${(goal.monthlyContribution / maxMonthly) * 100}%` }} />
                  </div>
                </div>
              ))}
          </div>
        ) : <p className="goal-plan-empty">{goalsContent.plan.noPlan}</p>}
      </section>
    </aside>
  );
}
