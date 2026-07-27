import { invoke } from "@tauri-apps/api/core";
import { getDesktopDatabase } from "@/lib/desktop/database";
import type {
  Argon2Credential,
  LocalSecuritySettings,
  PinVerificationResult,
  SecurityEventRecord,
} from "@/types/desktop-security";

export const defaultLocalSecuritySettings: LocalSecuritySettings = {
  pinEnabled: false,
  autoLockMinutes: 15,
  lockOnMinimize: true,
  requirePasswordForExports: true,
  requirePasswordForRestore: true,
  encryptedBackupsDefault: true,
  failedPinAttempts: 0,
  pinLockedUntil: null,
  lastLockedAt: null,
  vaultInitialized: false,
};

export function createArgon2Credential(secret: string): Promise<Argon2Credential> {
  return invoke<Argon2Credential>("create_argon2_credential", { secret });
}

export async function verifyUserPassword(
  userId: string,
  password: string,
  upgradeLegacy = true,
): Promise<boolean> {
  await getDesktopDatabase();
  return invoke<boolean>("verify_user_password", { userId, password, upgradeLegacy });
}

export async function changeAccountPassword(
  userId: string,
  currentPassword: string,
  newPassword: string,
): Promise<void> {
  await getDesktopDatabase();
  return invoke("change_account_password", { userId, currentPassword, newPassword });
}

export async function getLocalSecuritySettings(userId: string): Promise<LocalSecuritySettings> {
  await getDesktopDatabase();
  return invoke<LocalSecuritySettings>("get_security_settings", { userId });
}

export async function saveLocalSecuritySettings(
  userId: string,
  settings: LocalSecuritySettings,
): Promise<LocalSecuritySettings> {
  await getDesktopDatabase();
  return invoke<LocalSecuritySettings>("save_security_settings", { userId, settings });
}

export async function enableLocalPin(
  userId: string,
  currentPassword: string,
  pin: string,
): Promise<LocalSecuritySettings> {
  await getDesktopDatabase();
  return invoke<LocalSecuritySettings>("set_local_pin", { userId, currentPassword, pin });
}

export async function disableLocalPin(
  userId: string,
  currentPassword: string,
): Promise<LocalSecuritySettings> {
  await getDesktopDatabase();
  return invoke<LocalSecuritySettings>("disable_local_pin", { userId, currentPassword });
}

export async function verifyLocalPin(userId: string, pin: string): Promise<PinVerificationResult> {
  await getDesktopDatabase();
  return invoke<PinVerificationResult>("verify_local_pin", { userId, pin });
}

export async function recordLocalLock(userId: string, reason: string): Promise<void> {
  await getDesktopDatabase();
  return invoke("record_local_lock", { userId, reason });
}

export async function markVaultInitialized(userId: string): Promise<void> {
  await getDesktopDatabase();
  return invoke("mark_vault_initialized", { userId });
}

export async function listSecurityEvents(userId: string, limit = 30): Promise<SecurityEventRecord[]> {
  await getDesktopDatabase();
  return invoke<SecurityEventRecord[]>("list_security_events", { userId, limit });
}
