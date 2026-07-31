import { desktopWorkspaces } from "@/lib/desktop/workspaces";
import type {
  CreateWorkspaceInput,
  InviteMemberInput,
  WorkspaceRole,
} from "@/types/acessos";

export type InvitationDetails = {
  id: string;
  email: string;
  role: Exclude<WorkspaceRole, "owner">;
  invitedBy: string;
  expiresAt: string;
  workspace: { id: string; name: string; description: string };
};

export const workspacesApi = {
  list: () => desktopWorkspaces.list(),
  create: (input: CreateWorkspaceInput) => desktopWorkspaces.create(input),
  members: (workspaceId: string) => desktopWorkspaces.members(workspaceId),
  invitations: (workspaceId: string) => desktopWorkspaces.invitations(workspaceId),
  invite: (workspaceId: string, input: InviteMemberInput) => desktopWorkspaces.invite(workspaceId, input),
  updateMemberRole: (workspaceId: string, memberId: string, role: Exclude<WorkspaceRole, "owner">) =>
    desktopWorkspaces.updateMemberRole(workspaceId, memberId, role),
  removeMember: (workspaceId: string, memberId: string) => desktopWorkspaces.removeMember(workspaceId, memberId),
  resendInvitation: (workspaceId: string, invitationId: string) =>
    desktopWorkspaces.resendInvitation(workspaceId, invitationId),
  cancelInvitation: (workspaceId: string, invitationId: string) =>
    desktopWorkspaces.cancelInvitation(workspaceId, invitationId),
  invitationDetails: (_token: string): Promise<InvitationDetails> => desktopWorkspaces.invitationDetails(_token),
};
