import { CheckIcon, FileIcon, WarningIcon } from "@/components/shared/icons";
import { dataToolsContent } from "@/content/dados-e-automacoes";
import { formatCurrency } from "@/lib/formatters";
import type { ImportTransactionRow } from "@/types/dados-e-automacoes";

export function ImportPreview({
  rows,
  onChange,
  onToggle,
  onSelectAll,
  onClearSelection,
  onImport,
}: {
  rows: ImportTransactionRow[];
  onChange: (id: string, patch: Partial<ImportTransactionRow>) => void;
  onToggle: (id: string) => void;
  onSelectAll: () => void;
  onClearSelection: () => void;
  onImport: () => void;
}) {
  const selected = rows.filter((row) => row.selected && row.status !== "duplicate").length;
  const ready = rows.filter((row) => row.status === "ready").length;
  const review = rows.filter((row) => row.status === "review").length;
  const duplicates = rows.filter((row) => row.status === "duplicate").length;

  return (
    <section className="data-tool-panel import-preview-panel">
      <header className="data-tool-panel-header import-preview-header">
        <div>
          <span className="section-eyebrow">{dataToolsContent.views.import}</span>
          <h2>{dataToolsContent.preview.title}</h2>
          <p>{dataToolsContent.preview.description}</p>
        </div>
        <div className="import-preview-counts">
          <span><strong>{selected}</strong>{dataToolsContent.preview.selected}</span>
          <span><strong>{ready}</strong>{dataToolsContent.preview.ready}</span>
          <span><strong>{review}</strong>{dataToolsContent.preview.review}</span>
          <span><strong>{duplicates}</strong>{dataToolsContent.preview.duplicate}</span>
        </div>
      </header>

      {!rows.length ? (
        <div className="data-tools-empty-state">
          <span><FileIcon /></span>
          <p>{dataToolsContent.preview.noRows}</p>
        </div>
      ) : (
        <>
          <div className="import-preview-actions">
            <div>
              <button type="button" onClick={onSelectAll}>{dataToolsContent.preview.selectAll}</button>
              <button type="button" onClick={onClearSelection}>{dataToolsContent.preview.clearSelection}</button>
            </div>
            <small>{dataToolsContent.preview.editHint}</small>
          </div>
          <div className="import-preview-table-scroll">
            <table className="import-preview-table">
              <thead>
                <tr>
                  <th aria-label={dataToolsContent.preview.selected} />
                  <th>{dataToolsContent.preview.date}</th>
                  <th>{dataToolsContent.preview.descriptionField}</th>
                  <th>{dataToolsContent.preview.category}</th>
                  <th>{dataToolsContent.preview.account}</th>
                  <th>{dataToolsContent.preview.type}</th>
                  <th>{dataToolsContent.preview.status}</th>
                  <th>{dataToolsContent.preview.amount}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr className={row.status} key={row.id}>
                    <td>
                      <input
                        type="checkbox"
                        checked={row.selected}
                        disabled={row.status === "duplicate"}
                        onChange={() => onToggle(row.id)}
                      />
                    </td>
                    <td><input type="date" value={row.date} onChange={(event: React.ChangeEvent<HTMLInputElement>) => onChange(row.id, { date: event.target.value })} /></td>
                    <td>
                      <input value={row.description} onChange={(event: React.ChangeEvent<HTMLInputElement>) => onChange(row.id, { description: event.target.value })} />
                      {row.issues.length ? <small>{row.issues.join(" · ")}</small> : null}
                    </td>
                    <td><input value={row.category} onChange={(event: React.ChangeEvent<HTMLInputElement>) => onChange(row.id, { category: event.target.value })} /></td>
                    <td><input value={row.account} onChange={(event: React.ChangeEvent<HTMLInputElement>) => onChange(row.id, { account: event.target.value })} /></td>
                    <td>
                      <select value={row.type} onChange={(event: React.ChangeEvent<HTMLSelectElement>) => onChange(row.id, { type: event.target.value as ImportTransactionRow["type"] })}>
                        <option value="income">{dataToolsContent.preview.income}</option>
                        <option value="expense">{dataToolsContent.preview.expense}</option>
                        <option value="transfer">{dataToolsContent.preview.transfer}</option>
                      </select>
                    </td>
                    <td>
                      <span className={`import-row-status ${row.status}`}>
                        {row.status === "ready" ? <CheckIcon /> : <WarningIcon />}
                        {dataToolsContent.preview.statusLabels[row.status]}
                      </span>
                    </td>
                    <td className={row.type === "income" ? "positive" : "negative"}>{formatCurrency(row.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <footer className="import-preview-footer">
            <span>{selected} {dataToolsContent.preview.selected.toLocaleLowerCase("pt-BR")}</span>
            <button className="primary-action-button" type="button" onClick={onImport} disabled={!selected}>
              <CheckIcon />
              {dataToolsContent.preview.importSelected}
            </button>
          </footer>
        </>
      )}
    </section>
  );
}
