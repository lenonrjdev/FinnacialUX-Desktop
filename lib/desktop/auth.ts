import { ApiError } from "@/lib/api/client";
import { createInitials } from "@/lib/access-control";
import { createRecoveryToken } from "@/lib/desktop/crypto";
import { createArgon2Credential, verifyUserPassword } from "@/lib/desktop/security";
import { ensureDeviceBackupKey } from "@/lib/desktop/stronghold";
import { getDesktopDatabase } from "@/lib/desktop/database";
import { clearLocalSession, readLocalSessionUserId, saveLocalSessionUserId } from "@/lib/desktop/session";
import type { AuthenticatedProfile, PasswordRecoveryResponse } from "@/types/api";
import type { FinancialWorkspace } from "@/types/acessos";

export type LocalLoginResult = { user: AuthenticatedProfile };

function validateNewPassword(password: string) {
  if (password.length < 8 || !/[A-Za-zÀ-ÿ]/.test(password) || !/\d/.test(password)) {
    throw new ApiError("A senha precisa ter ao menos 8 caracteres, incluindo letra e número.", 400);
  }
}

type UserRow = {
  id: string;
  name: string;
  email: string;
  password_hash: string;
  password_salt: string;
  password_algorithm: string;
  phone: string | null;
  locale: string;
  timezone: string;
};

type PreferenceRow = {
  appearance: "system" | "light" | "dark";
  default_workspace_id: string | null;
  hide_balances_on_open: number;
  compact_large_values: number;
};

type WorkspaceRow = {
  id: string;
  name: string;
  description: string;
  kind: "personal" | "shared";
  created_at: string;
  last_activity_at: string;
};

async function findUserById(userId: string): Promise<UserRow | null> {
  const database = await getDesktopDatabase();
  const rows = await database.select<UserRow[]>(
    `SELECT id, name, email, password_hash, password_salt, password_algorithm, phone, locale, timezone
       FROM users
      WHERE id = $1
      LIMIT 1`,
    [userId],
  );
  return rows[0] ?? null;
}

async function findUserByEmail(email: string): Promise<UserRow | null> {
  const database = await getDesktopDatabase();
  const rows = await database.select<UserRow[]>(
    `SELECT id, name, email, password_hash, password_salt, password_algorithm, phone, locale, timezone
       FROM users
      WHERE lower(email) = lower($1)
      LIMIT 1`,
    [email.trim()],
  );
  return rows[0] ?? null;
}

async function getUserPreferences(userId: string): Promise<PreferenceRow> {
  const database = await getDesktopDatabase();
  const rows = await database.select<PreferenceRow[]>(
    `SELECT appearance, default_workspace_id, hide_balances_on_open, compact_large_values
       FROM user_preferences
      WHERE user_id = $1
      LIMIT 1`,
    [userId],
  );
  return rows[0] ?? {
    appearance: "system",
    default_workspace_id: null,
    hide_balances_on_open: 0,
    compact_large_values: 0,
  };
}

async function getUserWorkspaces(userId: string): Promise<FinancialWorkspace[]> {
  const database = await getDesktopDatabase();
  const rows = await database.select<WorkspaceRow[]>(
    `SELECT id, name, description, kind, created_at, last_activity_at
       FROM workspaces
      WHERE owner_user_id = $1
      ORDER BY created_at ASC`,
    [userId],
  );
  return rows.map((workspace) => ({
    id: workspace.id,
    name: workspace.name,
    description: workspace.description,
    kind: workspace.kind,
    role: "owner",
    membersCount: 1,
    createdAt: workspace.created_at,
    lastActivityAt: workspace.last_activity_at,
  }));
}

async function buildProfile(user: UserRow): Promise<AuthenticatedProfile> {
  const [preferences, workspaces] = await Promise.all([
    getUserPreferences(user.id),
    getUserWorkspaces(user.id),
  ]);
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    initials: createInitials(user.name),
    locale: user.locale,
    timezone: user.timezone,
    workspaces,
    preferences: {
      appearance: preferences.appearance,
      defaultWorkspaceId: preferences.default_workspace_id,
      hideBalancesOnOpen: Boolean(preferences.hide_balances_on_open),
      compactLargeValues: Boolean(preferences.compact_large_values),
    },
  };
}

export const desktopAuth = {
  async me(): Promise<AuthenticatedProfile> {
    const userId = readLocalSessionUserId();
    if (!userId) throw new ApiError("Entre para acessar seus dados locais.", 401);
    const user = await findUserById(userId);
    if (!user) {
      clearLocalSession();
      throw new ApiError("A conta local não foi encontrada.", 401);
    }
    return buildProfile(user);
  },

  async login(email: string, password: string, remember: boolean): Promise<LocalLoginResult> {
    const user = await findUserByEmail(email);
    if (!user || !(await verifyUserPassword(user.id, password, true))) {
      throw new ApiError("E-mail ou senha local inválidos.", 401);
    }
    await ensureDeviceBackupKey();
    saveLocalSessionUserId(user.id, remember);
    const updated = await findUserById(user.id);
    if (!updated) throw new ApiError("A conta local não foi encontrada após o acesso.", 401);
    return { user: await buildProfile(updated) };
  },

  async register(name: string, email: string, password: string): Promise<LocalLoginResult> {
    validateNewPassword(password);
    const database = await getDesktopDatabase();
    const normalizedEmail = email.trim().toLowerCase();
    if (await findUserByEmail(normalizedEmail)) {
      throw new ApiError("Já existe uma conta local com este e-mail.", 409);
    }

    const now = new Date().toISOString();
    const userId = crypto.randomUUID();
    const workspaceId = crypto.randomUUID();
    const credential = await createArgon2Credential(password);

    await database.execute(
      `INSERT INTO users (
        id, name, email, password_hash, password_salt, password_algorithm, phone, locale, timezone, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, '', $5, NULL, 'pt-BR', 'America/Sao_Paulo', $6, $6)`,
      [userId, name.trim(), normalizedEmail, credential.hash, credential.algorithm, now],
    );
    await database.execute(
      `INSERT INTO workspaces (
        id, owner_user_id, name, description, kind, created_at, last_activity_at
      ) VALUES ($1, $2, $3, $4, 'personal', $5, $5)`,
      [workspaceId, userId, `${name.trim().split(/\s+/)[0]} — Pessoal`, "Meu espaço financeiro offline", now],
    );
    await database.execute(
      `INSERT INTO user_preferences (
        user_id, appearance, default_workspace_id, default_account_id,
        hide_balances_on_open, compact_large_values, notify_upcoming_bills,
        notify_expected_income, notify_budget_alerts, notify_low_balance,
        notify_weekly_summary, notify_monthly_closing, notify_security_alerts,
        bill_reminder_days, low_balance_threshold, updated_at
      ) VALUES ($1, 'system', $2, NULL, 0, 0, 1, 1, 1, 1, 1, 1, 1, 3, 0, $3)`,
      [userId, workspaceId, now],
    );

    await ensureDeviceBackupKey();
    saveLocalSessionUserId(userId, true);
    const user = await findUserById(userId);
    if (!user) throw new ApiError("Não foi possível concluir a criação da conta local.", 500);
    return { user: await buildProfile(user) };
  },

  async logout(): Promise<{ message: string }> {
    clearLocalSession();
    return { message: "Sessão local encerrada." };
  },

  async forgotPassword(email: string): Promise<PasswordRecoveryResponse> {
    const database = await getDesktopDatabase();
    const user = await findUserByEmail(email);
    if (!user) return { message: "Se a conta existir, um token local foi preparado." };
    const token = createRecoveryToken();
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();
    await database.execute("DELETE FROM password_reset_tokens WHERE user_id = $1", [user.id]);
    await database.execute(
      `INSERT INTO password_reset_tokens (token, user_id, expires_at, created_at)
       VALUES ($1, $2, $3, $4)`,
      [token, user.id, expiresAt, new Date().toISOString()],
    );
    return { message: "Token local criado.", resetToken: token };
  },

  async resetPassword(token: string, password: string): Promise<{ message: string }> {
    validateNewPassword(password);
    const database = await getDesktopDatabase();
    const rows = await database.select<Array<{ user_id: string; expires_at: string }>>(
      `SELECT user_id, expires_at
         FROM password_reset_tokens
        WHERE token = $1
        LIMIT 1`,
      [token],
    );
    const reset = rows[0];
    if (!reset || new Date(reset.expires_at).getTime() < Date.now()) {
      throw new ApiError("O token local é inválido ou expirou.", 400);
    }
    const credential = await createArgon2Credential(password);
    await database.execute(
      `UPDATE users
          SET password_hash = $1, password_salt = '', password_algorithm = $2, updated_at = $3
        WHERE id = $4`,
      [credential.hash, credential.algorithm, new Date().toISOString(), reset.user_id],
    );
    await database.execute("DELETE FROM password_reset_tokens WHERE user_id = $1", [reset.user_id]);
    clearLocalSession();
    return { message: "Senha local atualizada." };
  },
};
