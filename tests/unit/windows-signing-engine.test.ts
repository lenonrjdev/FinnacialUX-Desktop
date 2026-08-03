import { describe, expect, it } from "vitest";
import {
  createWindowsSigningReadiness,
  daysUntilCertificateExpiry,
  normalizeCertificateThumbprint,
  sanitizeWindowsSigningError,
  validateWindowsSigningConfiguration,
} from "@/lib/windows-signing-engine";

const config = {
  formatVersion: 1 as const,
  provider: "certificate-store" as const,
  publisherDisplayName: "FinnacialUX",
  expectedPublisher: "CN=FinnacialUX",
  timestampUrl: "https://timestamp.example.test",
  digestAlgorithm: "SHA256" as const,
  timestampDigestAlgorithm: "SHA256" as const,
  certificateStore: { location: "CurrentUser" as const, name: "My" as const, thumbprint: "AA BB CC DD EE FF 00 11 22 33 44 55 66 77 88 99 AA BB CC DD" },
};

const ready = {
  provider: "certificate-store" as const,
  configured: true,
  signToolAvailable: true,
  certificateFound: true,
  hasPrivateKey: true,
  codeSigningEku: true,
  trustedChain: true,
  timestampConfigured: true,
  expectedPublisherConfigured: true,
  expiresAt: "2027-01-01T00:00:00.000Z",
  now: "2026-08-03T12:00:00.000Z",
};

describe("windows signing engine", () => {
  it("normaliza o thumbprint sem espaços", () => {
    expect(normalizeCertificateThumbprint("aa bb-cc")).toBe("AABBCC");
  });

  it("aprova uma cadeia completa", () => {
    const report = createWindowsSigningReadiness(ready);
    expect(report.ready).toBe(true);
    expect(report.blocked).toBe(0);
  });

  it("bloqueia certificado sem chave privada", () => {
    const report = createWindowsSigningReadiness({ ...ready, hasPrivateKey: false });
    expect(report.ready).toBe(false);
    expect(report.checks.find((item) => item.id === "private-key")?.status).toBe("blocked");
  });

  it("alerta quando a validade está próxima", () => {
    const report = createWindowsSigningReadiness({ ...ready, expiresAt: "2026-08-20T00:00:00.000Z" });
    expect(report.checks.find((item) => item.id === "expiry")?.status).toBe("attention");
  });

  it("calcula dias restantes", () => {
    expect(daysUntilCertificateExpiry("2026-08-05T00:00:00.000Z", new Date("2026-08-03T00:00:00.000Z"))).toBe(2);
  });

  it("valida SHA-256 e timestamp", () => {
    expect(validateWindowsSigningConfiguration(config)).toEqual([]);
    expect(validateWindowsSigningConfiguration({ ...config, digestAlgorithm: "SHA1" as never })).toContain("assinatura e timestamp devem usar SHA256");
  });

  it("exige marcador de arquivo no comando customizado", () => {
    const errors = validateWindowsSigningConfiguration({
      ...config,
      provider: "custom-command",
      certificateStore: undefined,
      customCommand: { cmd: "artifact-signing-cli", args: ["sign"] },
    });
    expect(errors).toContain("o comando customizado precisa do marcador {file} ou %1");
  });

  it("remove caminhos, tokens e segredos de erros", () => {
    const value = sanitizeWindowsSigningError(
      `C:\\segredos\\cert.pfx password=abc token=xyz ${"a".repeat(64)}`,
    );
    expect(value).not.toContain("cert.pfx");
    expect(value).not.toContain("password=abc");
    expect(value).not.toContain("token=xyz");
    expect(value).toContain("[CAMINHO_REMOVIDO]");
    expect(value.match(/SEGREDO_REMOVIDO/g)).toHaveLength(3);
  });

  it("remove caminho Windows entre aspas sem engolir o restante do erro", () => {
    const value = sanitizeWindowsSigningError(
      '"C:\\Pasta de Release\\certificado final.pfx" token=segredo detalhe preservado',
    );
    expect(value).toContain("[CAMINHO_REMOVIDO]");
    expect(value).toContain("token=[SEGREDO_REMOVIDO]");
    expect(value).toContain("detalhe preservado");
    expect(value).not.toContain("certificado final.pfx");
  });
});
