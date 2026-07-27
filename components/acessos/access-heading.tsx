import { PlusIcon, UserPlusIcon } from "@/components/shared/icons";
import { accessContent } from "@/content/acessos";

export function AccessHeading({
  onInvite,
  onCreateWorkspace,
  canInvite,
}: {
  onInvite: () => void;
  onCreateWorkspace: () => void;
  canInvite: boolean;
}) {
  return (
    <header className="financial-management-heading access-heading">
      <div>
        <span className="section-eyebrow">{accessContent.heading.eyebrow}</span>
        <h1>{accessContent.heading.title}</h1>
        <p>{accessContent.heading.description}</p>
      </div>
      <div className="transactions-heading-actions access-heading-actions">
        <button className="secondary-action-button" type="button" onClick={onCreateWorkspace}>
          <PlusIcon />
          {accessContent.heading.createWorkspace}
        </button>
        <button className="primary-action-button" type="button" onClick={onInvite} disabled={!canInvite}>
          <UserPlusIcon />
          {accessContent.heading.invite}
        </button>
      </div>
    </header>
  );
}
