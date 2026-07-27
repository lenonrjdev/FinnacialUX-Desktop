"use client";

import { useEffect, useMemo, useState } from "react";
import { AccessHeading } from "@/components/acessos/access-heading";
import { AccessOverviewPanel } from "@/components/acessos/access-overview-panel";
import { AccessSummary } from "@/components/acessos/access-summary";
import { InvitationsPanel } from "@/components/acessos/invitations-panel";
import { InviteDialog } from "@/components/acessos/invite-dialog";
import { MemberRoleDialog } from "@/components/acessos/member-role-dialog";
import { MembersPanel } from "@/components/acessos/members-panel";
import { PermissionMatrix } from "@/components/acessos/permission-matrix";
import { WorkspaceDialog } from "@/components/acessos/workspace-dialog";
import { WorkspacesPanel } from "@/components/acessos/workspaces-panel";
import { useAuth } from "@/components/providers/auth-provider";
import { CheckIcon } from "@/components/shared/icons";
import { accessContent } from "@/content/acessos";
import { matchesSearch } from "@/lib/search";
import { integrationContent } from "@/content/integracao";
import { getStoredWorkspaceId, persistWorkspaceId } from "@/lib/access-control";
import { workspacesApi } from "@/lib/api/workspaces";
import type {
  AccessInvitation,
  CreateWorkspaceInput,
  InviteMemberInput,
  WorkspaceMember,
  WorkspaceRole,
} from "@/types/acessos";

export default function AcessosView() {
  const { workspaces, refreshWorkspaces } = useAuth();
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [invitations, setInvitations] = useState<AccessInvitation[]>([]);
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState("");
  const [query, setQuery] = useState("");
  const [inviteOpen, setInviteOpen] = useState(false);
  const [workspaceDialogOpen, setWorkspaceDialogOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<WorkspaceMember | null>(null);
  const [feedback, setFeedback] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!workspaces.length) return;
    const storedId = getStoredWorkspaceId(workspaces[0].id);
    setSelectedWorkspaceId(workspaces.some((workspace) => workspace.id === storedId) ? storedId : workspaces[0].id);
  }, [workspaces]);

  useEffect(() => {
    if (!selectedWorkspaceId) return;
    setLoading(true);
    Promise.all([
      workspacesApi.members(selectedWorkspaceId),
      workspacesApi.invitations(selectedWorkspaceId),
    ])
      .then(([nextMembers, nextInvitations]) => {
        setMembers(nextMembers);
        setInvitations(nextInvitations);
      })
      .catch((caught) => showFeedback(caught instanceof Error ? caught.message : integrationContent.workspaceLoadError))
      .finally(() => setLoading(false));
  }, [selectedWorkspaceId]);

  const selectedWorkspace = workspaces.find((workspace) => workspace.id === selectedWorkspaceId) ?? workspaces[0];
  const currentRole = selectedWorkspace?.role ?? "viewer";
  const canManage = false;

  const selectedMembers = useMemo(() => members.filter((member) => matchesSearch(query, [
    member.name,
    member.email,
    member.role,
  ])), [members, query]);

  const pendingInvitationsCount = invitations.filter((invitation) => invitation.status === "pending").length;

  function showFeedback(message: string) {
    setFeedback(message);
    window.setTimeout(() => setFeedback(""), 3200);
  }

  function selectWorkspace(workspaceId: string) {
    setSelectedWorkspaceId(workspaceId);
    persistWorkspaceId(workspaceId);
    setQuery("");
    showFeedback(accessContent.feedback.workspaceChanged);
  }

  async function inviteMember(input: InviteMemberInput) {
    if (!selectedWorkspace) return;
    try {
      const invitation = await workspacesApi.invite(selectedWorkspace.id, input);
      setInvitations((current) => [invitation, ...current]);
      setInviteOpen(false);
      try {
        await navigator.clipboard.writeText(invitation.invitationUrl ?? "");
        showFeedback(integrationContent.inviteCopied);
      } catch {
        showFeedback(integrationContent.inviteCreated);
      }
    } catch (caught) {
      showFeedback(caught instanceof Error ? caught.message : integrationContent.unexpectedError);
    }
  }

  async function createWorkspace(input: CreateWorkspaceInput) {
    try {
      const workspace = await workspacesApi.create(input);
      await refreshWorkspaces();
      setSelectedWorkspaceId(workspace.id);
      persistWorkspaceId(workspace.id);
      setWorkspaceDialogOpen(false);
      showFeedback(accessContent.feedback.workspaceCreated);
    } catch (caught) {
      showFeedback(caught instanceof Error ? caught.message : integrationContent.unexpectedError);
    }
  }

  async function changeMemberRole(role: Exclude<WorkspaceRole, "owner">) {
    if (!editingMember || !selectedWorkspace) return;
    try {
      const updated = await workspacesApi.updateMemberRole(selectedWorkspace.id, editingMember.id, role);
      setMembers((current) => current.map((member) => member.id === updated.id ? updated : member));
      setEditingMember(null);
      showFeedback(accessContent.feedback.roleChanged);
    } catch (caught) {
      showFeedback(caught instanceof Error ? caught.message : integrationContent.unexpectedError);
    }
  }

  async function removeMember(member: WorkspaceMember) {
    if (!selectedWorkspace) return;
    try {
      await workspacesApi.removeMember(selectedWorkspace.id, member.id);
      setMembers((current) => current.filter((item) => item.id !== member.id));
      await refreshWorkspaces();
      showFeedback(accessContent.feedback.memberRemoved);
    } catch (caught) {
      showFeedback(caught instanceof Error ? caught.message : integrationContent.unexpectedError);
    }
  }

  async function resendInvitation(invitation: AccessInvitation) {
    if (!selectedWorkspace) return;
    try {
      const updated = await workspacesApi.resendInvitation(selectedWorkspace.id, invitation.id);
      setInvitations((current) => current.map((item) => item.id === updated.id ? updated : item));
      try { await navigator.clipboard.writeText(updated.invitationUrl ?? ""); } catch {}
      showFeedback(accessContent.feedback.invitationResent);
    } catch (caught) {
      showFeedback(caught instanceof Error ? caught.message : integrationContent.unexpectedError);
    }
  }

  async function cancelInvitation(invitation: AccessInvitation) {
    if (!selectedWorkspace) return;
    try {
      await workspacesApi.cancelInvitation(selectedWorkspace.id, invitation.id);
      setInvitations((current) => current.filter((item) => item.id !== invitation.id));
      showFeedback(accessContent.feedback.invitationCanceled);
    } catch (caught) {
      showFeedback(caught instanceof Error ? caught.message : integrationContent.unexpectedError);
    }
  }

  const unavailableEmails = [
    ...members.map((member) => member.email.toLowerCase()),
    ...invitations.filter((invitation) => invitation.status === "pending").map((invitation) => invitation.email.toLowerCase()),
  ];

  if (!selectedWorkspace) return <div className="backend-loading-screen">{integrationContent.loading}</div>;

  return (
    <div className="financial-management-page access-page">
      <AccessHeading onInvite={() => setInviteOpen(true)} onCreateWorkspace={() => setWorkspaceDialogOpen(true)} canInvite={canManage} />
      <AccessSummary workspacesCount={workspaces.length} membersCount={members.length} invitationsCount={pendingInvitationsCount} currentRole={currentRole} />

      <div className="access-main-grid">
        <WorkspacesPanel workspaces={workspaces} selectedWorkspaceId={selectedWorkspaceId} onSelect={selectWorkspace} />
        <AccessOverviewPanel />
      </div>

      {loading ? <div className="backend-inline-loading">{integrationContent.loading}</div> : (
        <>
          <MembersPanel members={selectedMembers} query={query} canManage={canManage} onQueryChange={setQuery} onEdit={setEditingMember} onRemove={removeMember} />
          <InvitationsPanel invitations={invitations} canManage={canManage} onResend={resendInvitation} onCancel={cancelInvitation} />
        </>
      )}

      <PermissionMatrix />

      {inviteOpen ? <InviteDialog workspace={selectedWorkspace} unavailableEmails={unavailableEmails} onClose={() => setInviteOpen(false)} onSubmit={inviteMember} /> : null}
      {workspaceDialogOpen ? <WorkspaceDialog onClose={() => setWorkspaceDialogOpen(false)} onSubmit={createWorkspace} /> : null}
      {editingMember ? <MemberRoleDialog member={editingMember} onClose={() => setEditingMember(null)} onSubmit={changeMemberRole} /> : null}

      {feedback ? <div className="transaction-feedback access-feedback" role="status"><CheckIcon />{feedback}</div> : null}
    </div>
  );
}
