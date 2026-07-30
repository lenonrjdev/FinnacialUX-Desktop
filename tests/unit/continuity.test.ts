import { describe, expect, it } from "vitest";
import {
  canRestoreRecoveryPoint,
  continuityHealthLabel,
  recoveryPointReasonLabel,
} from "@/lib/continuity";

describe("continuidade local", () => {
  it("traduz motivos conhecidos de recuperação", () => {
    expect(recoveryPointReasonLabel("pre_migration")).toBe("Antes da migração");
    expect(recoveryPointReasonLabel("daily_healthy")).toBe("Ponto diário saudável");
  });

  it("prioriza falha de integridade na classificação", () => {
    expect(continuityHealthLabel({
      integrity: { ok: false } as never,
      access: { readOnly: true } as never,
    })).toBe("Integridade comprometida");
  });

  it("identifica modo somente leitura saudável", () => {
    expect(continuityHealthLabel({
      integrity: { ok: true } as never,
      access: { readOnly: true } as never,
    })).toBe("Protegido em somente leitura");
  });

  it("bloqueia restauração de arquivos ausentes", () => {
    expect(canRestoreRecoveryPoint({ status: "missing", filePath: "C:/backup.fuxbackup" })).toBe(false);
    expect(canRestoreRecoveryPoint({ status: "available", filePath: "" })).toBe(false);
    expect(canRestoreRecoveryPoint({ status: "available", filePath: "C:/backup.fuxbackup" })).toBe(true);
  });
});
