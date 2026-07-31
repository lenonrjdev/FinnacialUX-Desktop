import { CheckIcon, HistoryIcon, WarningIcon } from "@/components/shared/icons";
import type { DiagnosticRunSummary } from "@/types/diagnostics";

function dateLabel(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString("pt-BR");
}

export function DiagnosticHistoryPanel({ runs }: { runs: DiagnosticRunSummary[] }) {
  return (
    <section className="settings-panel diagnostic-history-panel">
      <header className="settings-panel-header compact">
        <div>
          <span className="section-eyebrow">Histórico local</span>
          <h2>Auditorias anteriores</h2>
          <p>Somente pontuações, estados e contagens técnicas são armazenados.</p>
        </div>
      </header>
      {runs.length === 0 ? (
        <div className="diagnostic-empty-history"><HistoryIcon /><span>A primeira auditoria completa ainda não foi registrada.</span></div>
      ) : (
        <div className="diagnostic-run-list">
          {runs.map((run) => (
            <article key={run.id}>
              <span className={`diagnostic-run-score ${run.status}`}>
                {run.status === "healthy" ? <CheckIcon /> : <WarningIcon />}
                <strong>{run.score}</strong>
              </span>
              <div>
                <strong>{run.runKind === "full" ? "Auditoria completa" : "Execução técnica"}</strong>
                <small>{dateLabel(run.startedAt)}</small>
              </div>
              <div className="diagnostic-run-counts">
                <span>{run.checksPassed} aprovados</span>
                <span>{run.checksAttention} atenção</span>
                <span>{run.checksFailed} falhas</span>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
