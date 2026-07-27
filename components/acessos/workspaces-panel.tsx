import { CheckIcon, UsersIcon, WorkspaceIcon } from "@/components/shared/icons";
import { accessContent } from "@/content/acessos";
import { formatAccessDateTime } from "@/lib/access-control";
import type { FinancialWorkspace } from "@/types/acessos";

export function WorkspacesPanel({
  workspaces,
  selectedWorkspaceId,
  onSelect,
}: {
  workspaces: FinancialWorkspace[];
  selectedWorkspaceId: string;
  onSelect: (workspaceId: string) => void;
}) {
  return (
    <section className="access-panel workspace-list-panel">
      <header className="access-panel-header">
        <div>
          <h2>{accessContent.workspaces.title}</h2>
          <p>{accessContent.workspaces.description}</p>
        </div>
        <span className="access-panel-icon"><WorkspaceIcon /></span>
      </header>

      <div className="workspace-access-list">
        {workspaces.length ? workspaces.map((workspace) => {
          const selected = workspace.id === selectedWorkspaceId;
          const memberText = workspace.membersCount === 1
            ? accessContent.workspaces.member
            : accessContent.workspaces.members;

          return (
            <article className={`workspace-access-card ${selected ? "selected" : ""}`} key={workspace.id}>
              <div className="workspace-access-card-top">
                <span className="workspace-access-avatar"><WorkspaceIcon /></span>
                <div>
                  <span>{accessContent.workspaceKinds[workspace.kind]}</span>
                  <h3>{workspace.name}</h3>
                </div>
                {selected ? <span className="workspace-selected-badge"><CheckIcon /> {accessContent.workspaces.selected}</span> : null}
              </div>
              <p>{workspace.description}</p>
              <div className="workspace-access-meta">
                <span><UsersIcon /> {workspace.membersCount} {memberText}</span>
                <span>{accessContent.roles[workspace.role]}</span>
                <span>{accessContent.workspaces.lastActivity}: {formatAccessDateTime(workspace.lastActivityAt)}</span>
              </div>
              <button type="button" disabled={selected} onClick={() => onSelect(workspace.id)}>
                {selected ? accessContent.workspaces.currentAction : accessContent.workspaces.switchAction}
              </button>
            </article>
          );
        }) : <p className="access-empty-state">{accessContent.workspaces.empty}</p>}
      </div>
    </section>
  );
}
