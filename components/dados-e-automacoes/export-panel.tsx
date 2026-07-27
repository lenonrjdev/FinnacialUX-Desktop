import { DatabaseIcon, DownloadIcon, FileIcon } from "@/components/shared/icons";
import { dataToolsContent } from "@/content/dados-e-automacoes";
import { getReferenceDate } from "@/lib/reference-date";
import type {
  ExportConfiguration,
  ExportDataset,
  ExportTable,
} from "@/types/dados-e-automacoes";

const datasets = Object.keys(dataToolsContent.export.datasets) as ExportDataset[];

export function ExportPanel({
  configuration,
  preview,
  onChange,
  onExport,
}: {
  configuration: ExportConfiguration;
  preview: ExportTable | null;
  onChange: (patch: Partial<ExportConfiguration>) => void;
  onExport: () => void;
}) {
  const hasDates = configuration.dataset !== "accounts" && configuration.dataset !== "budgets" && configuration.dataset !== "full-backup";
  const extension = configuration.dataset === "full-backup" ? "json" : configuration.format;
  const fileName = `${preview?.fileBase ?? "backup-financeiro"}-${getReferenceDate()}.${extension}`;

  return (
    <section className="export-layout">
      <article className="data-tool-panel export-configuration-panel">
        <header className="data-tool-panel-header">
          <div>
            <span className="section-eyebrow">{dataToolsContent.views.export}</span>
            <h2>{dataToolsContent.export.title}</h2>
            <p>{dataToolsContent.export.description}</p>
          </div>
          <span className="data-tool-panel-icon"><DownloadIcon /></span>
        </header>

        <div className="export-form-grid">
          <label className="form-field export-dataset-field">
            <span>{dataToolsContent.export.dataset}</span>
            <select value={configuration.dataset} onChange={(event: React.ChangeEvent<HTMLSelectElement>) => onChange({ dataset: event.target.value as ExportDataset })}>
              {datasets.map((dataset) => <option value={dataset} key={dataset}>{dataToolsContent.export.datasets[dataset]}</option>)}
            </select>
          </label>
          <label className="form-field">
            <span>{dataToolsContent.export.format}</span>
            <select
              value={configuration.dataset === "full-backup" ? "json" : configuration.format}
              disabled={configuration.dataset === "full-backup"}
              onChange={(event: React.ChangeEvent<HTMLSelectElement>) => onChange({ format: event.target.value as ExportConfiguration["format"] })}
            >
              <option value="csv">{dataToolsContent.export.csv}</option>
              <option value="json">{dataToolsContent.export.json}</option>
            </select>
          </label>
          <label className="form-field">
            <span>{dataToolsContent.export.separator}</span>
            <select
              value={configuration.separator}
              disabled={configuration.format !== "csv" || configuration.dataset === "full-backup"}
              onChange={(event: React.ChangeEvent<HTMLSelectElement>) => onChange({ separator: event.target.value as ExportConfiguration["separator"] })}
            >
              <option value=";">{dataToolsContent.export.semicolon}</option>
              <option value=",">{dataToolsContent.export.comma}</option>
            </select>
          </label>
          <label className="export-checkbox-field">
            <input
              type="checkbox"
              checked={configuration.includeHeaders}
              disabled={configuration.format !== "csv" || configuration.dataset === "full-backup"}
              onChange={(event: React.ChangeEvent<HTMLInputElement>) => onChange({ includeHeaders: event.target.checked })}
            />
            <span>{dataToolsContent.export.includeHeaders}</span>
          </label>
          {hasDates ? (
            <>
              <label className="form-field">
                <span>{dataToolsContent.export.startDate}</span>
                <input type="date" value={configuration.startDate} onChange={(event: React.ChangeEvent<HTMLInputElement>) => onChange({ startDate: event.target.value })} />
              </label>
              <label className="form-field">
                <span>{dataToolsContent.export.endDate}</span>
                <input type="date" value={configuration.endDate} onChange={(event: React.ChangeEvent<HTMLInputElement>) => onChange({ endDate: event.target.value })} />
              </label>
            </>
          ) : (
            <p className="export-period-note">{configuration.dataset === "full-backup" ? dataToolsContent.export.backupNote : dataToolsContent.export.noPeriod}</p>
          )}
        </div>
      </article>

      <aside className="data-tool-panel export-preview-panel">
        <header className="data-tool-panel-header compact">
          <div>
            <span className="section-eyebrow">{dataToolsContent.export.period}</span>
            <h2>{dataToolsContent.export.previewTitle}</h2>
          </div>
          <span className="data-tool-panel-icon"><DatabaseIcon /></span>
        </header>
        <div className="export-preview-file">
          <span><FileIcon /></span>
          <div>
            <small>{dataToolsContent.export.fileName}</small>
            <strong>{fileName}</strong>
          </div>
        </div>
        <dl className="export-preview-details">
          <div><dt>{dataToolsContent.export.dataset}</dt><dd>{dataToolsContent.export.datasets[configuration.dataset]}</dd></div>
          <div><dt>{dataToolsContent.export.format}</dt><dd>{extension.toLocaleUpperCase("pt-BR")}</dd></div>
          <div><dt>{dataToolsContent.export.estimatedRows}</dt><dd>{configuration.dataset === "full-backup" ? dataToolsContent.export.fullBackupModules : String(preview?.rows.length ?? 0)}</dd></div>
          {hasDates ? <div><dt>{dataToolsContent.export.period}</dt><dd>{configuration.startDate || "—"} → {configuration.endDate || "—"}</dd></div> : null}
        </dl>
        <button className="primary-action-button export-now-button" type="button" onClick={onExport}>
          <DownloadIcon />
          {dataToolsContent.export.exportNow}
        </button>
      </aside>
    </section>
  );
}
