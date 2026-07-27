import { DownloadIcon, ReportsIcon } from "@/components/shared/icons";
import { reportsContent } from "@/content/relatorios";

export function ReportsHeading({
  onExport,
  onPrint,
}: {
  onExport: () => void;
  onPrint: () => void;
}) {
  return (
    <header className="financial-management-heading reports-heading">
      <div>
        <span className="section-eyebrow">{reportsContent.heading.eyebrow}</span>
        <h1>{reportsContent.heading.title}</h1>
        <p>{reportsContent.heading.description}</p>
      </div>

      <div className="transactions-heading-actions reports-heading-actions">
        <button className="secondary-action-button" type="button" onClick={onPrint}>
          <ReportsIcon />
          {reportsContent.heading.print}
        </button>
        <button className="primary-action-button" type="button" onClick={onExport}>
          <DownloadIcon />
          {reportsContent.heading.export}
        </button>
      </div>
    </header>
  );
}
