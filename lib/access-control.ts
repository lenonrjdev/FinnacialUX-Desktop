import type {
  PermissionKey,
  WorkspaceRole,
} from "@/types/acessos";

const rolePermissions: Record<WorkspaceRole, PermissionKey[]> = {
  owner: [
    "view-dashboard",
    "manage-transactions",
    "manage-planning",
    "manage-members",
    "export-data",
    "delete-workspace",
  ],
  editor: [
    "view-dashboard",
    "manage-transactions",
    "manage-planning",
    "export-data",
  ],
  viewer: ["view-dashboard", "export-data"],
};

export function roleCan(
  role: WorkspaceRole,
  permission: PermissionKey,
): boolean {
  return rolePermissions[role].includes(permission);
}

export function createInitials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

export function getStoredWorkspaceId(defaultWorkspaceId: string): string {
  if (typeof window === "undefined") return defaultWorkspaceId;
  return window.localStorage.getItem("finance-workspace-id") ?? defaultWorkspaceId;
}

export function persistWorkspaceId(workspaceId: string): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem("finance-workspace-id", workspaceId);
  window.dispatchEvent(new CustomEvent("finance-workspace-change", { detail: workspaceId }));
}

const accessDateFormatter = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  timeZone: "America/Sao_Paulo",
});

const accessDateTimeFormatter = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "America/Sao_Paulo",
});

export function formatAccessDate(value: string): string {
  const date = value.includes("T") ? new Date(value) : new Date(`${value}T12:00:00-03:00`);
  return accessDateFormatter.format(date);
}

export function formatAccessDateTime(value: string): string {
  return accessDateTimeFormatter.format(new Date(value));
}
