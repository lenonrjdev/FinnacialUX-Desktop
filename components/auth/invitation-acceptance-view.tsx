"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuth } from "@/components/providers/auth-provider";
import { MailIcon, ShieldIcon, UsersIcon, WorkspaceIcon } from "@/components/shared/icons";
import { accessContent, authContent } from "@/content/acessos";
import { integrationContent } from "@/content/integracao";
import { formatAccessDate, persistWorkspaceId } from "@/lib/access-control";
import { authApi } from "@/lib/api/auth";
import { workspacesApi, type InvitationDetails } from "@/lib/api/workspaces";

export function InvitationAcceptanceView({ token }: { token: string }) {
  const { user, loading, refreshWorkspaces } = useAuth();
  const [invitation, setInvitation] = useState<InvitationDetails | null>(null);
  const [error, setError] = useState("");
  const [accepting, setAccepting] = useState(false);

  useEffect(() => {
    workspacesApi.invitationDetails(token)
      .then(setInvitation)
      .catch((caught) => setError(caught instanceof Error ? caught.message : authContent.invitation.invalidDescription));
  }, [token]);

  async function acceptInvitation() {
    if (!user) {
      window.location.assign(`/login?convite=${encodeURIComponent(token)}`);
      return;
    }
    setAccepting(true);
    setError("");
    try {
      const result = await authApi.acceptInvitation(token);
      await refreshWorkspaces();
      persistWorkspaceId(result.workspaceId);
      window.location.assign("/acessos");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : authContent.invitation.invalidDescription);
    } finally {
      setAccepting(false);
    }
  }

  if (error) {
    return (
      <div className="auth-card invitation-card auth-success-card">
        <span className="auth-success-icon muted"><MailIcon /></span>
        <header className="auth-card-heading"><h2>{authContent.invitation.invalidTitle}</h2><p>{error}</p></header>
        <Link className="auth-submit-button" href="/login">{authContent.invitation.goLogin}</Link>
      </div>
    );
  }

  if (!invitation || loading) return <div className="auth-card"><p>{integrationContent.invitation.loading}</p></div>;

  return (
    <div className="auth-card invitation-card">
      <span className="invitation-main-icon"><UsersIcon /></span>
      <header className="auth-card-heading"><span>{authContent.invitation.eyebrow}</span><h2>{authContent.invitation.title}</h2><p>{authContent.invitation.description}</p></header>
      <dl className="invitation-details">
        <div><dt><WorkspaceIcon /> {authContent.invitation.workspace}</dt><dd>{invitation.workspace.name}</dd></div>
        <div><dt><MailIcon /> {authContent.invitation.invitedBy}</dt><dd>{invitation.invitedBy}</dd></div>
        <div><dt><ShieldIcon /> {authContent.invitation.permission}</dt><dd>{accessContent.roles[invitation.role]}</dd></div>
        <div><dt>{authContent.invitation.expires}</dt><dd>{formatAccessDate(invitation.expiresAt)}</dd></div>
      </dl>
      <button className="auth-submit-button" type="button" onClick={acceptInvitation} disabled={accepting}>{accepting ? integrationContent.invitation.accepting : authContent.invitation.accept}</button>
      <Link className="auth-back-link" href="/login">{authContent.invitation.decline}</Link>
      <small className="auth-demo-note">{integrationContent.invitation.emailRestrictionPrefix} {invitation.email}.</small>
    </div>
  );
}
