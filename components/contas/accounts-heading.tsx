import {
  ArrowRightLeftIcon,
  PlusIcon,
} from "@/components/shared/icons";
import { accountsContent } from "@/content/contas";

export function AccountsHeading({
  onTransfer,
  onCreate,
}: {
  onTransfer: () => void;
  onCreate: () => void;
}) {
  return (
    <header className="accounts-heading">
      <div>
        <span className="page-eyebrow">{accountsContent.heading.eyebrow}</span>
        <h1>{accountsContent.heading.title}</h1>
        <p>{accountsContent.heading.description}</p>
      </div>

      <div className="accounts-heading-actions">
        <button
          className="secondary-action-button"
          type="button"
          onClick={onTransfer}
        >
          <ArrowRightLeftIcon />
          {accountsContent.heading.transferAction}
        </button>
        <button
          className="primary-action-button"
          type="button"
          onClick={onCreate}
        >
          <PlusIcon />
          {accountsContent.heading.newAccountAction}
        </button>
      </div>
    </header>
  );
}
