import { DownloadIcon, UploadIcon } from "@/components/shared/icons";
import { dataToolsContent } from "@/content/dados-e-automacoes";

export function DataToolsHeading({
  onSample,
  onBackup,
}: {
  onSample: () => void;
  onBackup: () => void;
}) {
  return (
    <header className="financial-management-heading data-tools-heading">
      <div>
        <span className="section-eyebrow">{dataToolsContent.heading.eyebrow}</span>
        <h1>{dataToolsContent.heading.title}</h1>
        <p>{dataToolsContent.heading.description}</p>
      </div>
      <div className="transactions-heading-actions data-tools-heading-actions">
        <button className="secondary-action-button" type="button" onClick={onSample}>
          <UploadIcon />
          {dataToolsContent.heading.sample}
        </button>
        <button className="primary-action-button" type="button" onClick={onBackup}>
          <DownloadIcon />
          {dataToolsContent.heading.backup}
        </button>
      </div>
    </header>
  );
}
