import type Database from "@tauri-apps/plugin-sql";

const DATABASE_URL = "sqlite:finnacialux.db";
let databasePromise: Promise<Database> | null = null;

function hasTauriRuntime(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

export async function getDesktopDatabase(): Promise<Database> {
  if (!hasTauriRuntime()) {
    throw new Error(
      "O banco SQLite do FinnacialUX Desktop está disponível dentro do Tauri. Execute npm run desktop:dev.",
    );
  }

  if (!databasePromise) {
    databasePromise = import("@tauri-apps/plugin-sql")
      .then(({ default: SqlDatabase }) => SqlDatabase.load(DATABASE_URL));
  }

  return databasePromise;
}

export async function closeDesktopDatabase(): Promise<void> {
  const current = databasePromise;
  databasePromise = null;
  if (current) {
    const database = await current;
    await database.close();
    return;
  }

  if (!hasTauriRuntime()) return;
  const { default: SqlDatabase } = await import("@tauri-apps/plugin-sql");
  await SqlDatabase.get(DATABASE_URL).close();
}

export function isDesktopRuntime(): boolean {
  return hasTauriRuntime();
}
