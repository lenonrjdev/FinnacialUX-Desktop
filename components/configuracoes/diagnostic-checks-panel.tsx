import { CheckIcon, ClockIcon, WarningIcon } from "@/components/shared/icons";
import { groupDiagnosticChecks } from "@/lib/diagnostic-engine";
import type { DiagnosticSuiteResult } from "@/types/diagnostics";

function StatusIcon({ status }: { status: "passed" | "attention" | "failed" | "skipped" }) {
  if (status === "passed") return <CheckIcon />;
  if (status === "skipped") return <ClockIcon />;
  return <WarningIcon />;
}

export function DiagnosticChecksPanel({ suite }: { suite: DiagnosticSuiteResult }) {
  return (
    <section className="settings-panel diagnostic-checks-panel">
      <header className="settings-panel-header compact">
        <div>
          <span className="section-eyebrow">Auditoria explicável</span>
          <h2>Verificações locais</h2>
          <p>Cada resultado mostra o contrato validado. Nenhum saldo, descrição ou documento financeiro é exibido.</p>
        </div>
      </header>

      <div className="diagnostic-check-groups">
        {groupDiagnosticChecks(suite.checks).map((group) => (
          <section key={group.category} className="diagnostic-check-group">
            <div className="diagnostic-check-group-heading">
              <strong>{group.label}</strong>
              <span>{group.checks.length} verificações</span>
            </div>
            <div className="diagnostic-check-list">
              {group.checks.map((check) => (
                <article key={check.code} className={`diagnostic-check-row ${check.status}`}>
                  <span className="diagnostic-check-icon"><StatusIcon status={check.status} /></span>
                  <div>
                    <strong>{check.title}</strong>
                    <p>{check.detail}</p>
                  </div>
                  <small>{check.durationMs} ms</small>
                </article>
              ))}
            </div>
          </section>
        ))}
      </div>
    </section>
  );
}
