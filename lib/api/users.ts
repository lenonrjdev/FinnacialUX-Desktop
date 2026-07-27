import { desktopUsers } from "@/lib/desktop/users";

export type UserPreferencesResponse = {
  appearance: "system" | "light" | "dark";
  defaultWorkspaceId: string | null;
  defaultAccountId: string | null;
  hideBalancesOnOpen: boolean;
  compactLargeValues: boolean;
  notifyUpcomingBills: boolean;
  notifyExpectedIncome: boolean;
  notifyBudgetAlerts: boolean;
  notifyLowBalance: boolean;
  notifyWeeklySummary: boolean;
  notifyMonthlyClosing: boolean;
  notifySecurityAlerts: boolean;
  billReminderDays: number;
  lowBalanceThreshold: number;
};

export type UpdateUserPreferencesInput = Partial<
  Omit<UserPreferencesResponse, "defaultWorkspaceId" | "defaultAccountId">
>;

export const usersApi = {
  updateProfile: (input: {
    name: string;
    email: string;
    phone: string;
    locale: string;
    timezone: string;
  }) => desktopUsers.updateProfile(input),
  getPreferences: () => desktopUsers.getPreferences(),
  updatePreferences: (input: UpdateUserPreferencesInput) => desktopUsers.updatePreferences(input),
};
