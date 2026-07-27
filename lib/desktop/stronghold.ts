import { invoke } from "@tauri-apps/api/core";
import { appLocalDataDir, join } from "@tauri-apps/api/path";
import { Stronghold, type Client, type Store } from "@tauri-apps/plugin-stronghold";
import { hasTauriRuntime } from "@/lib/desktop/runtime";
import type { DatabaseKeyCandidate } from "@/types/desktop-database";

const CLIENT_NAME = "finnacialux-device-security";
const BACKUP_KEY_NAME = "backup-master-key";
const DATABASE_KEY_ACTIVE = "database-master-key-active";
const DATABASE_KEY_PENDING = "database-master-key-pending";
const DATABASE_KEY_PREVIOUS = "database-master-key-previous";
const VAULT_FILE_NAME = "finnacialux-security.hold";

type VaultSession = {
  stronghold: Stronghold;
  client: Client;
  store: Store;
};

let sessionPromise: Promise<VaultSession> | null = null;

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const value of bytes) binary += String.fromCharCode(value);
  return window.btoa(binary);
}

function createRandomKey(): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(32));
}

async function openVault(): Promise<VaultSession> {
  if (!hasTauriRuntime()) throw new Error("O cofre local está disponível apenas no aplicativo instalado.");
  const bootstrap = await invoke<string>("get_vault_bootstrap_secret");
  const vaultPath = await join(await appLocalDataDir(), VAULT_FILE_NAME);
  const stronghold = await Stronghold.load(vaultPath, bootstrap);
  let client: Client;
  try {
    client = await stronghold.loadClient(CLIENT_NAME);
  } catch {
    client = await stronghold.createClient(CLIENT_NAME);
  }
  return { stronghold, client, store: client.getStore() };
}

export function initializeSecurityVault(): Promise<VaultSession> {
  if (!sessionPromise) sessionPromise = openVault();
  return sessionPromise;
}

async function getOrCreateKey(name: string): Promise<Uint8Array> {
  const session = await initializeSecurityVault();
  let key = await session.store.get(name);
  if (!key) {
    key = createRandomKey();
    await session.store.insert(name, Array.from(key));
    await session.stronghold.save();
  }
  return new Uint8Array(key);
}

export async function ensureDeviceBackupKey(): Promise<string> {
  return bytesToBase64(await getOrCreateKey(BACKUP_KEY_NAME));
}

export async function ensureDeviceDatabaseKey(): Promise<string> {
  return bytesToBase64(await getOrCreateKey(DATABASE_KEY_ACTIVE));
}

export async function getDatabaseKeyCandidates(): Promise<DatabaseKeyCandidate[]> {
  const session = await initializeSecurityVault();
  const active = await session.store.get(DATABASE_KEY_ACTIVE);
  if (!active) {
    await ensureDeviceDatabaseKey();
  }

  const candidates: DatabaseKeyCandidate[] = [];
  for (const [source, name] of [
    ["active", DATABASE_KEY_ACTIVE],
    ["pending", DATABASE_KEY_PENDING],
    ["previous", DATABASE_KEY_PREVIOUS],
  ] as const) {
    const value = await session.store.get(name);
    if (!value) continue;
    const encoded = bytesToBase64(new Uint8Array(value));
    if (!candidates.some((candidate) => candidate.value === encoded)) {
      candidates.push({ source, value: encoded });
    }
  }
  return candidates;
}

export async function stageDatabaseKeyRotation(): Promise<string> {
  const session = await initializeSecurityVault();
  const pending = createRandomKey();
  await session.store.insert(DATABASE_KEY_PENDING, Array.from(pending));
  await session.stronghold.save();
  return bytesToBase64(pending);
}

export async function commitDatabaseKeyRotation(): Promise<void> {
  const session = await initializeSecurityVault();
  const active = await session.store.get(DATABASE_KEY_ACTIVE);
  const pending = await session.store.get(DATABASE_KEY_PENDING);
  if (!pending) throw new Error("A nova chave do banco não está preparada no Stronghold.");
  if (active) await session.store.insert(DATABASE_KEY_PREVIOUS, Array.from(active));
  await session.store.insert(DATABASE_KEY_ACTIVE, Array.from(pending));
  await session.store.remove(DATABASE_KEY_PENDING);
  await session.stronghold.save();
}

export async function recoverDatabaseKeyCandidate(source: DatabaseKeyCandidate["source"]): Promise<void> {
  if (source === "active") return;
  const session = await initializeSecurityVault();
  const sourceName = source === "pending" ? DATABASE_KEY_PENDING : DATABASE_KEY_PREVIOUS;
  const candidate = await session.store.get(sourceName);
  if (!candidate) return;
  const active = await session.store.get(DATABASE_KEY_ACTIVE);
  if (active) await session.store.insert(DATABASE_KEY_PREVIOUS, Array.from(active));
  await session.store.insert(DATABASE_KEY_ACTIVE, Array.from(candidate));
  if (source === "pending") await session.store.remove(DATABASE_KEY_PENDING);
  await session.stronghold.save();
}

export async function discardPendingDatabaseKey(): Promise<void> {
  const session = await initializeSecurityVault();
  await session.store.remove(DATABASE_KEY_PENDING);
  await session.stronghold.save();
}

export async function getSecurityVaultStatus(): Promise<{
  ready: boolean;
  keyAvailable: boolean;
  databaseKeyAvailable: boolean;
}> {
  try {
    const session = await initializeSecurityVault();
    const [backupKey, databaseKey] = await Promise.all([
      session.store.get(BACKUP_KEY_NAME),
      session.store.get(DATABASE_KEY_ACTIVE),
    ]);
    return {
      ready: true,
      keyAvailable: Boolean(backupKey),
      databaseKeyAvailable: Boolean(databaseKey),
    };
  } catch {
    return { ready: false, keyAvailable: false, databaseKeyAvailable: false };
  }
}

export async function unloadSecurityVault(): Promise<void> {
  const current = sessionPromise;
  sessionPromise = null;
  if (!current) return;
  const session = await current;
  await session.stronghold.unload();
}
