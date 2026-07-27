import { ApiError } from "@/lib/api/client";
import { getDesktopDatabase } from "@/lib/desktop/database";
import type { BindValue } from "@/lib/desktop/database";
import { readLocalSessionUserId } from "@/lib/desktop/session";
import type { UpdateUserPreferencesInput, UserPreferencesResponse } from "@/lib/api/users";

function requireUserId(): string {
  const userId = readLocalSessionUserId();
  if (!userId) throw new ApiError("Entre novamente para alterar suas configurações locais.", 401);
  return userId;
}

type PreferenceRow = {
  appearance: "system" | "light" | "dark";
  default_workspace_id: string | null;
  default_account_id: string | null;
  hide_balances_on_open: number;
  compact_large_values: number;
  notify_upcoming_bills: number;
  notify_expected_income: number;
  notify_budget_alerts: number;
  notify_low_balance: number;
  notify_weekly_summary: number;
  notify_monthly_closing: number;
  notify_security_alerts: number;
  bill_reminder_days: number;
  low_balance_threshold: number;
};

function toResponse(row: PreferenceRow): UserPreferencesResponse {
  return {
    appearance: row.appearance,
    defaultWorkspaceId: row.default_workspace_id,
    defaultAccountId: row.default_account_id,
    hideBalancesOnOpen: Boolean(row.hide_balances_on_open),
    compactLargeValues: Boolean(row.compact_large_values),
    notifyUpcomingBills: Boolean(row.notify_upcoming_bills),
    notifyExpectedIncome: Boolean(row.notify_expected_income),
    notifyBudgetAlerts: Boolean(row.notify_budget_alerts),
    notifyLowBalance: Boolean(row.notify_low_balance),
    notifyWeeklySummary: Boolean(row.notify_weekly_summary),
    notifyMonthlyClosing: Boolean(row.notify_monthly_closing),
    notifySecurityAlerts: Boolean(row.notify_security_alerts),
    billReminderDays: row.bill_reminder_days,
    lowBalanceThreshold: row.low_balance_threshold,
  };
}

const FIELD_MAP: Record<keyof UpdateUserPreferencesInput, string> = {
  appearance: "appearance",
  hideBalancesOnOpen: "hide_balances_on_open",
  compactLargeValues: "compact_large_values",
  notifyUpcomingBills: "notify_upcoming_bills",
  notifyExpectedIncome: "notify_expected_income",
  notifyBudgetAlerts: "notify_budget_alerts",
  notifyLowBalance: "notify_low_balance",
  notifyWeeklySummary: "notify_weekly_summary",
  notifyMonthlyClosing: "notify_monthly_closing",
  notifySecurityAlerts: "notify_security_alerts",
  billReminderDays: "bill_reminder_days",
  lowBalanceThreshold: "low_balance_threshold",
};

export const desktopUsers = {
  async updateProfile(input: {
    name: string;
    email: string;
    phone: string;
    locale: string;
    timezone: string;
  }) {
    const database = await getDesktopDatabase();
    const id = requireUserId();
    await database.execute(
      `UPDATE users
          SET name = $1, email = lower($2), phone = $3, locale = $4, timezone = $5, updated_at = $6
        WHERE id = $7`,
      [input.name.trim(), input.email.trim(), input.phone.trim() || null, input.locale, input.timezone, new Date().toISOString(), id],
    );
    return { id, ...input, phone: input.phone.trim() || null, email: input.email.trim().toLowerCase() };
  },

  async getPreferences(): Promise<UserPreferencesResponse> {
    const database = await getDesktopDatabase();
    const rows = await database.select<PreferenceRow[]>(
      `SELECT appearance, default_workspace_id, default_account_id,
              hide_balances_on_open, compact_large_values,
              notify_upcoming_bills, notify_expected_income, notify_budget_alerts,
              notify_low_balance, notify_weekly_summary, notify_monthly_closing,
              notify_security_alerts, bill_reminder_days, low_balance_threshold
         FROM user_preferences
        WHERE user_id = $1
        LIMIT 1`,
      [requireUserId()],
    );
    if (!rows[0]) throw new ApiError("Preferências locais não encontradas.", 404);
    return toResponse(rows[0]);
  },

  async updatePreferences(input: UpdateUserPreferencesInput): Promise<UserPreferencesResponse> {
    const database = await getDesktopDatabase();
    const entries = (Object.entries(input) as Array<[keyof UpdateUserPreferencesInput, unknown]>)
      .filter(([, value]) => value !== undefined);
    if (entries.length) {
      const assignments = entries.map(([key], index) => `${FIELD_MAP[key]} = $${index + 1}`);
      const values: BindValue[] = entries.map(([, value]) =>
        typeof value === "boolean" ? Number(value) : (value as BindValue),
      );
      values.push(new Date().toISOString(), requireUserId());
      await database.execute(
        `UPDATE user_preferences
            SET ${assignments.join(", ")}, updated_at = $${entries.length + 1}
          WHERE user_id = $${entries.length + 2}`,
        values,
      );
    }
    return desktopUsers.getPreferences();
  },
};
