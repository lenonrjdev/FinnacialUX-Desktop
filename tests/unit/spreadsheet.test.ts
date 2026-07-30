import { describe, expect, it } from "vitest";
import {
  buildSpreadsheetFile,
  buildTemplateWorkbook,
  parseSpreadsheetFile,
} from "@/lib/spreadsheet";

describe("planilhas", () => {
  it("gera e reabre uma planilha com múltiplas abas", async () => {
    const bytes = await buildSpreadsheetFile([
      {
        name: "Lançamentos/Julho:*?",
        table: {
          fileBase: "lancamentos",
          headers: ["Data", "Descrição", "Valor"],
          rows: [["29/07/2026", "Mercado", -125.9]],
        },
      },
      {
        name: "Contas",
        table: {
          fileBase: "contas",
          headers: ["Nome", "Saldo"],
          rows: [["Conta principal", 2500]],
        },
      },
    ]);

    expect(bytes.byteLength).toBeGreaterThan(500);
    const first = await parseSpreadsheetFile(bytes, "dados.xlsx");
    expect(first.worksheetNames).toEqual(["Lançamentos Julho", "Contas"]);
    expect(first.selectedWorksheet).toBe("Lançamentos Julho");
    expect(first.records[0]).toMatchObject({ Data: "29/07/2026", Descrição: "Mercado" });

    const second = await parseSpreadsheetFile(bytes, "dados.xls", "Contas");
    expect(second.sourceType).toBe("xls");
    expect(second.selectedWorksheet).toBe("Contas");
    expect(second.records[0]).toMatchObject({ Nome: "Conta principal", Saldo: "2500" });
  });

  it("gera o modelo oficial com quatro abas", async () => {
    const bytes = await buildTemplateWorkbook();
    const parsed = await parseSpreadsheetFile(bytes, "modelo.xlsx");

    expect(parsed.worksheetNames).toEqual([
      "Lançamentos",
      "Contas",
      "Contas a pagar",
      "Recebimentos",
    ]);
    expect(parsed.headers).toEqual(["Data", "Descrição", "Valor", "Tipo", "Categoria", "Conta"]);
    expect(parsed.records).toHaveLength(1);
  });

  it("usa a primeira aba quando a aba solicitada não existe", async () => {
    const bytes = await buildSpreadsheetFile([{ name: "Dados", table: { fileBase: "dados", headers: ["A"], rows: [[1]] } }]);
    const parsed = await parseSpreadsheetFile(bytes, "dados.xlsx", "Inexistente");

    expect(parsed.selectedWorksheet).toBe("Dados");
  });
});
