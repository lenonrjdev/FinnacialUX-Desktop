import { ApiError } from "@/lib/api/client";
import { createInitials } from "@/lib/access-control";
import { getDesktopDatabase } from "@/lib/desktop/database";
import { readLocalSessionUserId } from "@/lib/desktop/session";
import type {
  AccessInvitation,
  CreateWorkspaceInput,
  FinancialWorkspace,
  InviteMemberInput,
  WorkspaceMember,
  WorkspaceRole,
} from "@/types/acessos";

function requireUserId(): string {
  const userId = readLocalSessionUserId();
  if (!userId) throw new ApiError("Entre novamente para acessar seus espaços locais.", 401);
  return userId;
}

type WorkspaceRow = {
  id: string;
  name: string;
  description: string;
  kind: "personal" | "shared";
  created_at: string;
  last_activity_at: string;
};

type UserRow = { id: string; name: string; email: string; created_at: string };

function toWorkspace(row: WorkspaceRow): FinancialWorkspace {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    kind: row.kind,
    role: "owner",
    membersCount: 1,
    createdAt: row.created_at,
    lastActivityAt: row.last_activity_at,
  };
}

function sharingUnavailable(): never {
  throw new ApiError(
    "O compartilhamento entre pessoas depende do FinnacialUX Core e será conectado em uma fase futura. No modo Desktop offline, os espaços são locais.",
    501,
  );
}

export const desktopWorkspaces = {
  async list(): Promise<FinancialWorkspace[]> {
    const database = await getDesktopDatabase();
    const rows = await database.select<WorkspaceRow[]>(
      `SELECT id, name, description, kind, created_at, last_activity_at
         FROM workspaces
        WHERE owner_user_id = $1
        ORDER BY created_at ASC`,
      [requireUserId()],
    );
    return rows.map(toWorkspace);
  },

  async create(input: CreateWorkspaceInput): Promise<FinancialWorkspace> {
    const database = await getDesktopDatabase();
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    await database.execute(
      `INSERT INTO workspaces (id, owner_user_id, name, description, kind, created_at, last_activity_at)
       VALUES ($1, $2, $3, $4, 'personal', $5, $5)`,
      [id, requireUserId(), input.name.trim(), input.description.trim(), now],
    );
    return {
      id,
      name: input.name.trim(),
      description: input.description.trim(),
      kind: "personal",
      role: "owner",
      membersCount: 1,
      createdAt: now,
      lastActivityAt: now,
    };
  },

  async members(workspaceId: string): Promise<WorkspaceMember[]> {
    const database = await getDesktopDatabase();
    const rows = await database.select<UserRow[]>(
      `SELECT users.id, users.name, users.email, users.created_at
         FROM users
         JOIN workspaces ON workspaces.owner_user_id = users.id
        WHERE workspaces.id = $1 AND users.id = $2
        LIMIT 1`,
      [workspaceId, requireUserId()],
    );
    return rows.map((user) => ({
      id: user.id,
      workspaceId,
      name: user.name,
      email: user.email,
      initials: createInitials(user.name),
      role: "owner",
      joinedAt: user.created_at,
      lastAccessAt: new Date().toISOString(),
      isCurrentUser: true,
    }));
  },

  invitations: async (_workspaceId: string): Promise<AccessInvitation[]> => [],
  invite: async (_workspaceId: string, _input: InviteMemberInput): Promise<AccessInvitation & { token: string; invitationUrl: string }> => sharingUnavailable(),
  updateMemberRole: async (_workspaceId: string, _memberId: string, _role: Exclude<WorkspaceRole, "owner">): Promise<WorkspaceMember> => sharingUnavailable(),
  removeMember: async (_workspaceId: string, _memberId: string): Promise<{ message: string }> => sharingUnavailable(),
  resendInvitation: async (_workspaceId: string, _invitationId: string): Promise<AccessInvitation & { token: string; invitationUrl: string }> => sharingUnavailable(),
  cancelInvitation: async (_workspaceId: string, _invitationId: string): Promise<{ message: string }> => sharingUnavailable(),
  invitationDetails: async (_token: string): Promise<never> => sharingUnavailable(),
};
