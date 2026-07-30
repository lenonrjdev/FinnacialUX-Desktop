import { describe, expect, it } from "vitest";
import { decodeUtf8, encodeUtf8 } from "@/lib/desktop/file-transfer";

describe("codificação de arquivos", () => {
  it("preserva acentos e símbolos financeiros em UTF-8", () => {
    const source = "Descrição;Valor\nAlimentação;R$ 125,90";
    expect(decodeUtf8(encodeUtf8(source))).toBe(source);
  });

  it("decodifica bytes inválidos sem interromper a importação", () => {
    expect(decodeUtf8(new Uint8Array([0x66, 0x6f, 0x80]))).toContain("fo");
  });
});
