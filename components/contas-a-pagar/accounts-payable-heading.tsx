import { PlusIcon } from "@/components/shared/icons";
import { payablesContent } from "@/content/contas-a-pagar";

export function AccountsPayableHeading({ onNew }: { onNew: () => void }) {
  return (
    <header className="financial-management-heading">
      <div>
        <span className="section-eyebrow">{payablesContent.heading.eyebrow}</span>
        <h1>{payablesContent.heading.title}</h1>
        <p>{payablesContent.heading.description}</p>
      </div>

      <button className="primary-action-button" type="button" onClick={onNew}>
        <PlusIcon />
        {payablesContent.heading.newAction}
      </button>
    </header>
  );
}
