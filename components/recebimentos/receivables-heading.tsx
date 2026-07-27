import { PlusIcon } from "@/components/shared/icons";
import { receivablesContent } from "@/content/recebimentos";

export function ReceivablesHeading({ onNew }: { onNew: () => void }) {
  return (
    <header className="financial-management-heading">
      <div>
        <span className="section-eyebrow">{receivablesContent.heading.eyebrow}</span>
        <h1>{receivablesContent.heading.title}</h1>
        <p>{receivablesContent.heading.description}</p>
      </div>

      <button className="primary-action-button" type="button" onClick={onNew}>
        <PlusIcon />
        {receivablesContent.heading.newAction}
      </button>
    </header>
  );
}
