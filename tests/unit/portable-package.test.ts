import { describe, expect, it } from "vitest";
import {
  buildPortablePayload,
  decryptPortablePackage,
  encryptPortablePackage,
  mergePortableDocuments,
  sha256Hex,
  stableStringify,
} from "@/lib/portable-package";

describe("pacote portátil", () => {
  it("serializa objetos de maneira estável", () => {
    expect(stableStringify({ z: 1, a: { d: 4, b: 2 }, list: [{ y: 2, x: 1 }] }))
      .toBe('{"a":{"b":2,"d":4},"list":[{"x":1,"y":2}],"z":1}');
  });

  it("calcula SHA-256 em formato hexadecimal", async () => {
    await expect(sha256Hex("abc")).resolves.toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    );
  });

  it("constrói manifesto com checksums e totais por módulo", async () => {
    const payload = await buildPortablePayload({
      appVersion: "0.8.0",
      workspaceId: "workspace-1",
      documents: {
        transactions: [{ id: "tx-1" }, { id: "tx-2" }],
        preferences: { currency: "BRL" },
        empty: null,
      },
    });

    expect(payload).toMatchObject({
      product: "FinnacialUX Desktop",
      formatVersion: 1,
      appVersion: "0.8.0",
      sourceWorkspaceId: "workspace-1",
      totals: { modules: 3, records: 3 },
    });
    expect(Object.keys(payload.documentChecksums).sort()).toEqual(["empty", "preferences", "transactions"]);
    expect(payload.documentChecksums.transactions).toHaveLength(64);
  });

  it("criptografa e abre o pacote com a senha correta", async () => {
    const payload = await buildPortablePayload({
      appVersion: "0.8.0",
      workspaceId: "workspace-1",
      documents: {
        transactions: [{ id: "tx-1", amount: 125.9 }],
        accounts: [{ id: "acc-1", balance: 2500 }],
      },
    });
    const packaged = await encryptPortablePackage(payload, "SenhaForte#2026");
    const preview = await decryptPortablePackage(packaged.bytes, "SenhaForte#2026", "dados.fuxportable");

    expect(packaged.checksumSha256).toHaveLength(64);
    expect(preview).toMatchObject({
      fileName: "dados.fuxportable",
      appVersion: "0.8.0",
      sourceWorkspaceId: "workspace-1",
      modules: ["accounts", "transactions"],
      records: 2,
      documents: payload.documents,
    });
  });

  it("recusa senha curta antes de gerar o pacote", async () => {
    const payload = await buildPortablePayload({
      appVersion: "0.8.0",
      workspaceId: "workspace-1",
      documents: {},
    });

    await expect(encryptPortablePackage(payload, "123"))
      .rejects.toThrow("pelo menos 10 caracteres");
  });

  it("recusa senha incorreta", async () => {
    const payload = await buildPortablePayload({
      appVersion: "0.8.0",
      workspaceId: "workspace-1",
      documents: { transactions: [{ id: "tx-1" }] },
    });
    const packaged = await encryptPortablePackage(payload, "SenhaCorreta#2026");

    await expect(decryptPortablePackage(packaged.bytes, "SenhaErrada#2026", "dados.fuxportable"))
      .rejects.toThrow("Confirme a senha");
  });

  it("recusa envelope adulterado", async () => {
    const payload = await buildPortablePayload({
      appVersion: "0.8.0",
      workspaceId: "workspace-1",
      documents: { transactions: [{ id: "tx-1" }] },
    });
    const packaged = await encryptPortablePackage(payload, "SenhaForte#2026");
    const envelope = JSON.parse(new TextDecoder().decode(packaged.bytes)) as {
      encryptedPayloadB64: string;
    };
    const original = envelope.encryptedPayloadB64;
    envelope.encryptedPayloadB64 = `${original.slice(0, -2)}${original.endsWith("AA") ? "BB" : "AA"}`;
    const tampered = new TextEncoder().encode(JSON.stringify(envelope));

    await expect(decryptPortablePackage(tampered, "SenhaForte#2026", "alterado.fuxportable"))
      .rejects.toThrow();
  });

  it("recusa checksum inválido de um módulo", async () => {
    const payload = await buildPortablePayload({
      appVersion: "0.8.0",
      workspaceId: "workspace-1",
      documents: { transactions: [{ id: "tx-1" }] },
    });
    payload.documentChecksums.transactions = "0".repeat(64);
    const packaged = await encryptPortablePackage(payload, "SenhaForte#2026");

    await expect(decryptPortablePackage(packaged.bytes, "SenhaForte#2026", "dados.fuxportable"))
      .rejects.toThrow("módulo transactions");
  });

  it("valida manifesto JSON e assinatura do formato", async () => {
    await expect(decryptPortablePackage(new TextEncoder().encode("não é json"), "SenhaForte#2026", "x.fuxportable"))
      .rejects.toThrow("manifesto JSON válido");

    const invalid = new TextEncoder().encode(JSON.stringify({
      magic: "OUTRO",
      formatVersion: 1,
      encrypted: true,
      algorithm: "PBKDF2-SHA256+AES-256-GCM",
    }));
    await expect(decryptPortablePackage(invalid, "SenhaForte#2026", "x.fuxportable"))
      .rejects.toThrow("Formato de pacote portátil não reconhecido");
  });
});

describe("mesclagem portátil", () => {
  it("atualiza itens pelo id, adiciona novos e preserva módulos ausentes", () => {
    const merged = mergePortableDocuments(
      {
        transactions: [{ id: "tx-1", amount: 100 }, { id: "tx-2", amount: 200 }],
        accounts: [{ id: "acc-1" }],
        preferences: { currency: "BRL" },
      },
      {
        transactions: [{ id: "tx-2", amount: 250 }, { id: "tx-3", amount: 300 }],
        preferences: { currency: "USD" },
      },
    );

    expect(merged.transactions).toEqual([
      { id: "tx-1", amount: 100 },
      { id: "tx-2", amount: 250 },
      { id: "tx-3", amount: 300 },
    ]);
    expect(merged.accounts).toEqual([{ id: "acc-1" }]);
    expect(merged.preferences).toEqual({ currency: "USD" });
  });

  it("remove duplicidades de itens sem id usando conteúdo estável", () => {
    const merged = mergePortableDocuments(
      { tags: [{ label: "A", active: true }] },
      { tags: [{ active: true, label: "A" }, { label: "B" }] },
    );

    expect(merged.tags).toEqual([{ active: true, label: "A" }, { label: "B" }]);
  });
});
