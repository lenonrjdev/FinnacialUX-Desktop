import { MailIcon, ShieldIcon, UsersIcon, WorkspaceIcon } from "@/components/shared/icons";
import { accessContent } from "@/content/acessos";
import type { WorkspaceRole } from "@/types/acessos";

export function AccessSummary({
  workspacesCount,
  membersCount,
  invitationsCount,
  currentRole,
}: {
  workspacesCount: number;
  membersCount: number;
  invitationsCount: number;
  currentRole: WorkspaceRole;
}) {
  const cards = [
    {
      key: "workspaces",
      label: accessContent.summary.workspaces,
      value: String(workspacesCount),
      helper: accessContent.summary.workspacesHelper,
      icon: <WorkspaceIcon />,
      featured: true,
    },
    {
      key: "members",
      label: accessContent.summary.members,
      value: String(membersCount),
      helper: accessContent.summary.membersHelper,
      icon: <UsersIcon />,
    },
    {
      key: "invitations",
      label: accessContent.summary.invitations,
      value: String(invitationsCount),
      helper: accessContent.summary.invitationsHelper,
      icon: <MailIcon />,
    },
    {
      key: "role",
      label: accessContent.summary.currentRole,
      value: accessContent.roles[currentRole],
      helper: accessContent.summary.currentRoleHelper,
      icon: <ShieldIcon />,
    },
  ];

  return (
    <section className="access-summary-grid" aria-label={accessContent.accessibility.summary}>
      {cards.map((card) => (
        <article className={`access-summary-card ${card.featured ? "featured" : ""}`} key={card.key}>
          <span className="access-summary-icon">{card.icon}</span>
          <span>{card.label}</span>
          <strong>{card.value}</strong>
          <small>{card.helper}</small>
        </article>
      ))}
    </section>
  );
}
