import { CheckIcon, InfoIcon, WarningIcon } from "@/components/shared/icons";
import { intelligenceContent } from "@/content/intelligence";
import { formatCurrency } from "@/lib/formatters";
import type { IntelligenceRisk } from "@/types/financial-intelligence";

function RiskIcon({ severity }: { severity: IntelligenceRisk["severity"] }) {
  if (severity === "critical" || severity === "attention") return <WarningIcon />;
  return <InfoIcon />;
}

export function IntelligenceRiskPanel({ risks }: { risks: IntelligenceRisk[] }) {
  return (
    <article className="report-panel intelligence-risk-panel">
      <header className="report-panel-header">
        <div>
          <h2>{intelligenceContent.panels.risks}</h2>
          <p>{intelligenceContent.panels.risksDescription}</p>
        </div>
      </header>

      {risks.length === 0 ? (
        <div className="intelligence-empty-state"><CheckIcon />{intelligenceContent.empty.risks}</div>
      ) : (
        <div className="intelligence-risk-list">
          {risks.map((risk) => (
            <article className={risk.severity} key={risk.id}>
              <span className="intelligence-risk-icon"><RiskIcon severity={risk.severity} /></span>
              <div>
                <header>
                  <strong>{risk.title}</strong>
                  {risk.value !== null && Math.abs(risk.value) > 100 ? <span>{formatCurrency(risk.value)}</span> : null}
                </header>
                <p>{risk.message}</p>
                <small>{risk.recommendation}</small>
                <details>
                  <summary>Como foi calculado</summary>
                  <p>{risk.explanation}</p>
                </details>
              </div>
            </article>
          ))}
        </div>
      )}
    </article>
  );
}
