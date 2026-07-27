import { invoke } from "@tauri-apps/api/core";
import {
  commitDatabaseKeyRotation,
  discardPendingDatabaseKey,
  getDatabaseKeyCandidates,
  recoverDatabaseKeyCandidate,
  stageDatabaseKeyRotation,
} from "@/lib/desktop/stronghold";
import { hasTauriRuntime } from "@/lib/desktop/runtime";
import type {
  DatabaseEncryptionStatus,
  DatabaseExecuteResult,
} from "@/types/desktop-database";

export type BindValue = string | number | boolean | null | Uint8Array | Record<string, unknown>;

export type DesktopDatabase = {
  execute: (sql: string, values?: BindValue[]) => Promise<DatabaseExecuteResult>;
  select: <T>(sql: string, values?: BindValue[]) => Promise<T>;
  close: () => Promise<void>;
};

let databasePromise: Promise<DesktopDatabase> | null = null;
let encryptionStatus: DatabaseEncryptionStatus | null = null;

function normalizeValues(values: BindValue[]): unknown[] {
  return values.map((value) => value instanceof Uint8Array ? Array.from(value) : value);
}

async function openEncryptedDatabase(): Promise<DesktopDatabase> {
  if (!hasTauriRuntime()) {
    throw new Error(
      "O banco SQLCipher do FinnacialUX Desktop está disponível dentro do Tauri. Execute npm run desktop:dev.",
    );
  }

  const candidates = await getDatabaseKeyCandidates();
  let lastError: unknown;
  for (const candidate of candidates) {
    try {
      encryptionStatus = await invoke<DatabaseEncryptionStatus>("encrypted_database_open", {
        keyB64: candidate.value,
      });
      await recoverDatabaseKeyCandidate(candidate.source);
      return {
        execute: (sql, values = []) => invoke<DatabaseExecuteResult>("encrypted_database_execute", {
          sql,
          values: normalizeValues(values),
        }),
        select: <T,>(sql: string, values: BindValue[] = []) => invoke<T>("encrypted_database_select", {
          sql,
          values: normalizeValues(values),
        }),
        close: async () => {
          await invoke("encrypted_database_close");
          encryptionStatus = null;
        },
      };
    } catch (caught) {
      lastError = caught;
    }
  }
  throw new Error(
    typeof lastError === "string"
      ? lastError
      : "O Stronghold não conseguiu desbloquear o banco criptografado.",
  );
}

export async function getDesktopDatabase(): Promise<DesktopDatabase> {
  if (!databasePromise) {
    databasePromise = openEncryptedDatabase().catch((error) => {
      databasePromise = null;
      throw error;
    });
  }
  return databasePromise;
}

export async function getDatabaseEncryptionStatus(refresh = false): Promise<DatabaseEncryptionStatus> {
  await getDesktopDatabase();
  if (!refresh && encryptionStatus) return encryptionStatus;
  const status = await invoke<DatabaseEncryptionStatus>("encrypted_database_status");
  encryptionStatus = status;
  return status;
}

export async function rotateDatabaseEncryptionKey(): Promise<DatabaseEncryptionStatus> {
  await getDesktopDatabase();
  const pendingKey = await stageDatabaseKeyRotation();
  try {
    const status = await invoke<DatabaseEncryptionStatus>("encrypted_database_rekey", {
      newKeyB64: pendingKey,
    });
    await commitDatabaseKeyRotation();
    encryptionStatus = status;
    return status;
  } catch (caught) {
    await discardPendingDatabaseKey().catch(() => undefined);
    throw caught;
  }
}

export async function closeDesktopDatabase(): Promise<void> {
  const current = databasePromise;
  databasePromise = null;
  encryptionStatus = null;
  if (current) {
    try {
      const database = await current;
      await database.close();
      return;
    } catch {
      // Aberturas interrompidas também precisam limpar a chave nativa em memória.
    }
  }
  if (hasTauriRuntime()) await invoke("encrypted_database_close");
}

export function isDesktopRuntime(): boolean {
  return hasTauriRuntime();
}
