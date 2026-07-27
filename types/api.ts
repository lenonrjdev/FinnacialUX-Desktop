import type { FinancialWorkspace, SessionUser } from "@/types/acessos";

export type AuthenticatedProfile = SessionUser & {
  phone?: string | null;
  locale: string;
  timezone: string;
  workspaces: FinancialWorkspace[];
  preferences?: {
    appearance: "system" | "light" | "dark";
    defaultWorkspaceId: string | null;
    hideBalancesOnOpen: boolean;
    compactLargeValues: boolean;
  } | null;
};

export type ApiMessage = { message: string };

export type PasswordRecoveryResponse = ApiMessage & {
  resetToken?: string;
};
