import type { ExportTable, ImportParseResult, RawImportRecord } from "@/types/dados-e-automacoes";

async function loadSheetJs() {
  return import("xlsx");
}

function normalizeCell(value: unknown): string {
  if (value == null) return "";
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === "number") return String(value);
  if (typeof value === "boolean") return value ? "true" : "false";
  return String(value).trim();
}

function rowsToRecords(rows: unknown[][]): { headers: string[]; records: RawImportRecord[] } {
  const headerRow = rows[0] ?? [];
  const headers = headerRow.map((value, index) => normalizeCell(value) || `Coluna ${index + 1}`);
  const records = rows.slice(1)
    .filter((row) => row.some((value) => normalizeCell(value) !== ""))
    .map((row) => Object.fromEntries(headers.map((header, index) => [header, normalizeCell(row[index])])));
  return { headers, records };
}

export async function parseSpreadsheetFile(
  bytes: Uint8Array,
  fileName: string,
  selectedWorksheet?: string,
): Promise<ImportParseResult> {
  const XLSX = await loadSheetJs();
  const workbook = XLSX.read(bytes, { type: "array", cellDates: true, dense: true });
  const worksheetNames = workbook.SheetNames;
  if (!worksheetNames.length) throw new Error("A planilha não possui abas disponíveis.");
  const worksheetName = selectedWorksheet && worksheetNames.includes(selectedWorksheet)
    ? selectedWorksheet
    : worksheetNames[0];
  const worksheet = workbook.Sheets[worksheetName];
  const rows = XLSX.utils.sheet_to_json(worksheet, {
    header: 1,
    raw: false,
    defval: "",
    blankrows: false,
  }) as unknown[][];
  const { headers, records } = rowsToRecords(rows);
  return {
    sourceType: fileName.toLowerCase().endsWith(".xls") ? "xls" : "xlsx",
    fileName,
    headers,
    records,
    worksheetNames,
    selectedWorksheet: worksheetName,
  };
}

function safeWorksheetName(value: string, index: number): string {
  const clean = value.replace(/[\\/?*\[\]:]/g, " ").trim().slice(0, 31);
  return clean || `Dados ${index + 1}`;
}

export async function buildSpreadsheetFile(
  tables: Array<{ name: string; table: ExportTable }>,
): Promise<Uint8Array> {
  const XLSX = await loadSheetJs();
  const workbook = XLSX.utils.book_new();
  tables.forEach(({ name, table }, index) => {
    const rows = [Array.from(table.headers), ...table.rows];
    const worksheet = XLSX.utils.aoa_to_sheet(rows);
    worksheet["!cols"] = table.headers.map((header, columnIndex) => ({
      wch: Math.min(42, Math.max(String(header).length + 2, ...table.rows.slice(0, 100).map((row) => String(row[columnIndex] ?? "").length + 2))),
    }));
    XLSX.utils.book_append_sheet(workbook, worksheet, safeWorksheetName(name, index));
  });
  const output = XLSX.write(workbook, { type: "array", bookType: "xlsx", compression: true }) as ArrayBuffer | Uint8Array;
  return output instanceof Uint8Array ? output : new Uint8Array(output);
}

export async function buildTemplateWorkbook(): Promise<Uint8Array> {
  const templates: Array<{ name: string; table: ExportTable }> = [
    {
      name: "Lançamentos",
      table: {
        fileBase: "modelo-lancamentos",
        headers: ["Data", "Descrição", "Valor", "Tipo", "Categoria", "Conta"],
        rows: [["29/07/2026", "Exemplo de lançamento", -125.9, "Despesa", "Alimentação", "Conta principal"]],
      },
    },
    {
      name: "Contas",
      table: {
        fileBase: "modelo-contas",
        headers: ["Nome", "Instituição", "Tipo", "Saldo atual", "Conta principal"],
        rows: [["Conta principal", "Banco de exemplo", "corrente", 2500, true]],
      },
    },
    {
      name: "Contas a pagar",
      table: {
        fileBase: "modelo-contas-a-pagar",
        headers: ["Vencimento", "Descrição", "Categoria", "Conta", "Valor", "Situação"],
        rows: [["31/07/2026", "Conta de energia", "Casa", "Conta principal", 180, "pendente"]],
      },
    },
    {
      name: "Recebimentos",
      table: {
        fileBase: "modelo-recebimentos",
        headers: ["Data prevista", "Descrição", "Origem", "Conta", "Valor", "Situação"],
        rows: [["05/08/2026", "Projeto digital", "Cliente", "Conta principal", 1800, "pendente"]],
      },
    },
  ];
  return buildSpreadsheetFile(templates);
}
