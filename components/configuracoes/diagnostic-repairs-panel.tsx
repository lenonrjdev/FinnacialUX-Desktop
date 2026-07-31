import { RefreshIcon, ShieldIcon, WarningIcon } from "@/components/shared/icons";
import { diagnosticRepairLabels } from "@/lib/diagnostic-engine";
import type { DiagnosticRepairAction, DiagnosticRepairRecord } from "@/types/diagnostics";

const repairDescriptions: Record<DiagnosticRepairAction, string> = {
  optimize_database: "Executa checkpoint, ANALYZE e PRAGMA optimize sem alterar documentos financeiros.",
  release_stale_tasks: "Finaliza tarefas presas e remove somente leases locais já expirados.",
  refresh_file_health: "Reconfere se backups e pontos de recuperação ainda existem no disco.",
  clear_old_logs: "Remove apenas logs técnicos com mais de 30 dias.",
};

export function DiagnosticRepairsPanel({
  actions,
  records,
  readOnly,
  busy,
  onRepair,
}: {
  actions: DiagnosticRepairAction[];
  records: DiagnosticRepairRecord[];
  readOnly: boolean;
  busy: boolean;
  onRepair: (action: DiagnosticRepairAction) => void;
}) {
  return (
    <section className="settings-panel diagnostic-repairs-panel">
      <header className="settings-panel-header compact">
        <div>
          <span className="section-eyebrow">Ações controladas</span>
          <h2>Reparos seguros</h2>
          <p>Somente manutenção técnica reversível. Senhas, chaves e lançamentos nunca são alterados.</p>
        </div>
      </header>

      {readOnly ? (
        <div className="diagnostic-repair-warning"><WarningIcon /><span>Reparos bloqueados enquanto o banco estiver em modo somente leitura.</span></div>
      ) : null}

      {actions.length > 0 ? (
        <div className="diagnostic-repair-list">
          {actions.map((action) => (
            <article key={action}>
              <span><ShieldIcon /></span>
              <div><strong>{diagnosticRepairLabels[action]}</strong><p>{repairDescriptions[action]}</p></div>
              <button type="button" disabled={readOnly || busy} onClick={() => onRepair(action)}><RefreshIcon /> Executar</button>
            </article>
          ))}
        </div>
      ) : (
        <div className="diagnostic-no-repairs"><ShieldIcon /><div><strong>Nenhum reparo recomendado</strong><span>A auditoria não encontrou manutenção automática necessária.</span></div></div>
      )}

      {records.length > 0 ? (
        <div className="diagnostic-repair-history">
          <strong>Reparos recentes</strong>
          {records.slice(0, 5).map((record) => (
            <article key={record.id}>
              <span className={record.status}>{record.status === "succeeded" ? "Concluído" : record.status === "failed" ? "Falhou" : "Em andamento"}</span>
              <div><strong>{diagnosticRepairLabels[record.actionKind]}</strong><small>{record.resultSummary}</small></div>
            </article>
          ))}
        </div>
      ) : null}
    </section>
  );
}
