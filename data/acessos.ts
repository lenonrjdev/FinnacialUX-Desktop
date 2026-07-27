import { accessContent } from "@/content/acessos";
import type {
  AccessInvitation,
  FinancialWorkspace,
  PermissionDefinition,
  SessionUser,
  WorkspaceMember,
} from "@/types/acessos";

export const demoSessionUser: SessionUser = { id: "", name: "", email: "", initials: "" };
export const initialWorkspaces: FinancialWorkspace[] = [];
export const initialWorkspaceMembers: WorkspaceMember[] = [];
export const initialAccessInvitations: AccessInvitation[] = [];

export const permissionDefinitions: PermissionDefinition[] = [
  {
    key: "view-dashboard",
    label: accessContent.permissions.items.viewDashboard.label,
    description: accessContent.permissions.items.viewDashboard.description,
  },
  {
    key: "manage-transactions",
    label: accessContent.permissions.items.manageTransactions.label,
    description: accessContent.permissions.items.manageTransactions.description,
  },
  {
    key: "manage-planning",
    label: accessContent.permissions.items.managePlanning.label,
    description: accessContent.permissions.items.managePlanning.description,
  },
  {
    key: "manage-members",
    label: accessContent.permissions.items.manageMembers.label,
    description: accessContent.permissions.items.manageMembers.description,
  },
  {
    key: "export-data",
    label: accessContent.permissions.items.exportData.label,
    description: accessContent.permissions.items.exportData.description,
  },
  {
    key: "delete-workspace",
    label: accessContent.permissions.items.deleteWorkspace.label,
    description: accessContent.permissions.items.deleteWorkspace.description,
  },
];
