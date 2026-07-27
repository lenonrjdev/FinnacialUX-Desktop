export type WorkspaceRole = "owner" | "editor" | "viewer";

export type WorkspaceKind = "personal" | "shared";

export type InvitationStatus = "pending" | "accepted" | "expired" | "revoked";

export type PermissionKey =
  | "view-dashboard"
  | "manage-transactions"
  | "manage-planning"
  | "manage-members"
  | "export-data"
  | "delete-workspace";

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  initials: string;
};

export type FinancialWorkspace = {
  id: string;
  name: string;
  description: string;
  kind: WorkspaceKind;
  role: WorkspaceRole;
  membersCount: number;
  createdAt: string;
  lastActivityAt: string;
};

export type WorkspaceMember = {
  id: string;
  workspaceId: string;
  name: string;
  email: string;
  initials: string;
  role: WorkspaceRole;
  joinedAt: string;
  lastAccessAt: string;
  isCurrentUser?: boolean;
};

export type AccessInvitation = {
  id: string;
  workspaceId: string;
  email: string;
  role: Exclude<WorkspaceRole, "owner">;
  invitedBy: string;
  sentAt: string;
  expiresAt: string;
  status: InvitationStatus;
  token?: string;
  invitationUrl?: string;
};

export type PermissionDefinition = {
  key: PermissionKey;
  label: string;
  description: string;
};

export type InviteMemberInput = {
  email: string;
  role: Exclude<WorkspaceRole, "owner">;
};

export type CreateWorkspaceInput = {
  name: string;
  description: string;
};

export type AuthCredentials = {
  email: string;
  password: string;
};

export type RegisterInput = {
  name: string;
  email: string;
  password: string;
  passwordConfirmation: string;
  acceptedTerms: boolean;
};
