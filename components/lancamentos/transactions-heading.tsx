import { DownloadIcon, PlusIcon } from "@/components/shared/icons";
import { transactionsContent } from "@/content/lancamentos";

export function TransactionsHeading({
  onCreate,
  onExport,
}: {
  onCreate: () => void;
  onExport: () => void;
}) {
  return (
    <header className="transactions-heading">
      <div>
        <span className="page-eyebrow">{transactionsContent.heading.eyebrow}</span>
        <h1>{transactionsContent.heading.title}</h1>
        <p>{transactionsContent.heading.description}</p>
      </div>

      <div className="transactions-heading-actions">
        <button
          className="secondary-action-button"
          type="button"
          onClick={onExport}
        >
          <DownloadIcon />
          {transactionsContent.heading.exportAction}
        </button>
        <button className="primary-action-button" type="button" onClick={onCreate}>
          <PlusIcon />
          {transactionsContent.heading.newAction}
        </button>
      </div>
    </header>
  );
}
