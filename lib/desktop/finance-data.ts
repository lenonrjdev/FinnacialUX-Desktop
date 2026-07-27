import { ApiError } from "@/lib/api/client";
import { getDesktopDatabase } from "@/lib/desktop/database";
import { isSafeModeEnabled } from "@/lib/desktop/protection";
import type { FinanceDataDocument, FinanceDataDocuments } from "@/lib/api/finance-data";

function readWorkspaceId(): string {
  if (typeof window === "undefined") throw new ApiError("Espaço local indisponível.", 400);
  const workspaceId = window.localStorage.getItem("finance-workspace-id");
  if (!workspaceId) throw new ApiError("Selecione um espaço financeiro local.", 400);
  return workspaceId;
}

type DocumentRow = { module: string; data_json: string; updated_at: string };

function parseDocument(row: DocumentRow): FinanceDataDocument {
  return {
    data: JSON.parse(row.data_json) as unknown,
    updatedAt: row.updated_at,
  };
}

export const desktopFinanceData = {
  async list(): Promise<FinanceDataDocuments> {
    const database = await getDesktopDatabase();
    const rows = await database.select<DocumentRow[]>(
      `SELECT module, data_json, updated_at
         FROM finance_documents
        WHERE workspace_id = $1`,
      [readWorkspaceId()],
    );
    return Object.fromEntries(rows.map((row) => [row.module, parseDocument(row)]));
  },

  async get<T>(module: string): Promise<{ module: string; data: T | null; updatedAt: string | null }> {
    const database = await getDesktopDatabase();
    const rows = await database.select<DocumentRow[]>(
      `SELECT module, data_json, updated_at
         FROM finance_documents
        WHERE workspace_id = $1 AND module = $2
        LIMIT 1`,
      [readWorkspaceId(), module],
    );
    const row = rows[0];
    return {
      module,
      data: row ? JSON.parse(row.data_json) as T : null,
      updatedAt: row?.updated_at ?? null,
    };
  },

  async save<T>(module: string, data: T): Promise<{ module: string; data: T; updatedAt: string }> {
    if (isSafeModeEnabled()) {
      throw new ApiError("O modo seguro está ativo. Saia do modo seguro para alterar dados.", 423);
    }
    const database = await getDesktopDatabase();
    const workspaceId = readWorkspaceId();
    const updatedAt = new Date().toISOString();
    await database.execute(
      `INSERT INTO finance_documents (workspace_id, module, data_json, updated_at)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT(workspace_id, module)
       DO UPDATE SET data_json = excluded.data_json, updated_at = excluded.updated_at`,
      [workspaceId, module, JSON.stringify(data), updatedAt],
    );
    await database.execute(
      "UPDATE workspaces SET last_activity_at = $1 WHERE id = $2",
      [updatedAt, workspaceId],
    );
    return { module, data, updatedAt };
  },

  async remove(module: string): Promise<{ message: string }> {
    if (isSafeModeEnabled()) {
      throw new ApiError("O modo seguro está ativo. Saia do modo seguro para alterar dados.", 423);
    }
    const database = await getDesktopDatabase();
    await database.execute(
      "DELETE FROM finance_documents WHERE workspace_id = $1 AND module = $2",
      [readWorkspaceId(), module],
    );
    return { message: "Documento financeiro local removido." };
  },
};
