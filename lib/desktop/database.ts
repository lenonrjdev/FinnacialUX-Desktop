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

export function isDesktopRuntime(): boolean {
  return hasTauriRuntime();
}
