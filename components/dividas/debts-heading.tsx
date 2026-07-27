import { DebtIcon, PlusIcon, ReceiptIcon } from "@/components/shared/icons";
import { debtsContent } from "@/content/dividas";

export function DebtsHeading({
  onNewDebt,
  onNewPayment,
}: {
  onNewDebt: () => void;
  onNewPayment: () => void;
}) {
  return (
    <header className="financial-management-heading debts-heading">
      <div>
        <span className="section-eyebrow">{debtsContent.heading.eyebrow}</span>
        <h1>{debtsContent.heading.title}</h1>
        <p>{debtsContent.heading.description}</p>
      </div>
      <div className="transactions-heading-actions">
        <button className="secondary-action-button" type="button" onClick={onNewPayment}>
          <ReceiptIcon />
          {debtsContent.heading.newPayment}
        </button>
        <button className="primary-action-button" type="button" onClick={onNewDebt}>
          <PlusIcon />
          {debtsContent.heading.newDebt}
        </button>
      </div>
    </header>
  );
}
