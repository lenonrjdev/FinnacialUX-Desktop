import { CheckIcon, FileIcon, WarningIcon } from "@/components/shared/icons";
import { dataToolsContent } from "@/content/dados-e-automacoes";
import type { ImportHistoryItem } from "@/types/dados-e-automacoes";

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export function ImportHistory({ history }: { history: ImportHistoryItem[] }) {
  const ordered = [...history].sort((a, b) => b.importedAt.localeCompare(a.importedAt));
  return (
    <section className="data-tool-panel import-history-panel">
      <header className="data-tool-panel-header">
        <div>
          <span className="section-eyebrow">{dataToolsContent.views.history}</span>
          <h2>{dataToolsContent.history.title}</h2>
          <p>{dataToolsContent.history.description}</p>
        </div>
        <span className="data-tool-panel-icon"><FileIcon /></span>
      </header>
      {ordered.length ? (
        <div className="import-history-table-scroll">
          <table className="import-history-table">
            <thead><tr><th>{dataToolsContent.history.file}</th><th>{dataToolsContent.history.date}</th><th>{dataToolsContent.history.imported}</th><th>{dataToolsContent.history.ignored}</th><th>{dataToolsContent.history.duplicates}</th><th>{dataToolsContent.history.status}</th></tr></thead>
            <tbody>
              {ordered.map((item) => (
                <tr key={item.id}>
                  <td><span className="history-file-icon"><FileIcon /></span><div><strong>{item.fileName}</strong><small>{dataToolsContent.sourceTypes[item.sourceType]}</small></div></td>
                  <td>{formatDateTime(item.importedAt)}</td>
                  <td><strong>{item.importedRows}</strong></td>
                  <td>{item.ignoredRows}</td>
                  <td>{item.duplicateRows}</td>
                  <td><span className={`history-status ${item.status}`}>{item.status === "completed" ? <CheckIcon /> : <WarningIcon />}{item.status === "completed" ? dataToolsContent.history.completed : dataToolsContent.history.partial}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : <p className="data-tools-empty-copy">{dataToolsContent.history.empty}</p>}
    </section>
  );
}
