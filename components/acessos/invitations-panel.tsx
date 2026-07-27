import { MailIcon, TrashIcon, UploadIcon } from "@/components/shared/icons";
import { accessContent } from "@/content/acessos";
import { formatAccessDate, formatAccessDateTime } from "@/lib/access-control";
import type { AccessInvitation } from "@/types/acessos";

export function InvitationsPanel({
  invitations,
  canManage,
  onResend,
  onCancel,
}: {
  invitations: AccessInvitation[];
  canManage: boolean;
  onResend: (invitation: AccessInvitation) => void;
  onCancel: (invitation: AccessInvitation) => void;
}) {
  return (
    <section className="access-panel invitations-panel">
      <header className="access-panel-header">
        <div>
          <h2>{accessContent.invitations.title}</h2>
          <p>{accessContent.invitations.description}</p>
        </div>
        <span className="access-panel-icon"><MailIcon /></span>
      </header>

      {invitations.length ? (
        <div className="invitation-access-list">
          {invitations.map((invitation) => (
            <article key={invitation.id}>
              <span className="invitation-email-icon"><MailIcon /></span>
              <div className="invitation-main-copy">
                <strong>{invitation.email}</strong>
                <span>{accessContent.roles[invitation.role]}</span>
              </div>
              <div className="invitation-date-copy">
                <span>{accessContent.invitations.sentAt}</span>
                <strong>{formatAccessDateTime(invitation.sentAt)}</strong>
              </div>
              <div className="invitation-date-copy">
                <span>{accessContent.invitations.expiresAt}</span>
                <strong>{formatAccessDate(invitation.expiresAt)}</strong>
              </div>
              <span className={`invitation-status ${invitation.status}`}>
                {accessContent.invitations[invitation.status]}
              </span>
              <div className="invitation-actions">
                <button type="button" disabled={!canManage} onClick={() => onResend(invitation)}>
                  <UploadIcon /> {accessContent.invitations.resend}
                </button>
                <button className="danger" type="button" disabled={!canManage} onClick={() => onCancel(invitation)}>
                  <TrashIcon /> {accessContent.invitations.cancel}
                </button>
              </div>
            </article>
          ))}
        </div>
      ) : <div className="access-empty-state"><MailIcon /> {accessContent.invitations.empty}</div>}
    </section>
  );
}
