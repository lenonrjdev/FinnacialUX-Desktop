import { describe, expect, it } from "vitest";
import {
  createReleaseReadinessReport,
  parseDesktopVersion,
  releaseAssetName,
  releaseChannel,
  releaseTag,
  stableReleaseConfig,
} from "@/lib/release-candidate";

const readySnapshot = {
  version: "1.1.0",
  schemaVersion: 14,
  updaterConfigured: true,
  developmentBuild: false,
  backupBeforeInstall: true,
  windowsRuntime: true,
};

const stableConfig = {
  ...stableReleaseConfig,
  version: "1.1.0",
  promotedFrom: "1.0.0",
};

describe("stable release", () => {
  it("interpreta versão estável e candidata", () => {
    expect(parseDesktopVersion("1.1.0")).toEqual({
      valid: true,
      major: 1,
      minor: 1,
      patch: 0,
      prerelease: null,
    });
    expect(parseDesktopVersion("0.18.0-rc.1").prerelease).toBe("rc.1");
  });

  it("distingue desenvolvimento, candidato e estável", () => {
    expect(releaseChannel("0.18.0-rc.1")).toBe("release-candidate");
    expect(releaseChannel("1.1.0")).toBe("stable");
    expect(releaseChannel("1.1.0", true)).toBe("development");
  });

  it("gera nomes determinísticos da versão 1.1", () => {
    expect(releaseTag("1.1.0")).toBe("desktop-v1.1.0");
    expect(releaseAssetName("1.1.0")).toBe("FinnacialUX-Desktop_1.1.0_x64-setup.exe");
  });

  it("aprova a versão estável com schema congelado e proteções ativas", () => {
    const report = createReleaseReadinessReport(readySnapshot, stableConfig);
    expect(report.ready).toBe(true);
    expect(report.blocked).toBe(0);
    expect(report.channel).toBe("stable");
    expect(report.promotedFrom).toBe("1.0.0");
  });

  it("bloqueia divergência de schema", () => {
    const report = createReleaseReadinessReport({ ...readySnapshot, schemaVersion: 15 }, stableConfig);
    expect(report.ready).toBe(false);
    expect(report.checks.find((item) => item.id === "schema")?.status).toBe("blocked");
  });

  it("bloqueia publicação sem updater e backup pré-atualização", () => {
    const report = createReleaseReadinessReport({
      ...readySnapshot,
      updaterConfigured: false,
      backupBeforeInstall: false,
    }, stableConfig);
    expect(report.ready).toBe(false);
    expect(report.blocked).toBe(2);
  });

  it("bloqueia configuração sem procedência da RC", () => {
    const report = createReleaseReadinessReport(readySnapshot, { ...stableConfig, promotedFrom: undefined });
    expect(report.ready).toBe(false);
    expect(report.checks.find((item) => item.id === "promotion")?.status).toBe("blocked");
  });

  it("trata modo de desenvolvimento como atenção", () => {
    const report = createReleaseReadinessReport({ ...readySnapshot, developmentBuild: true }, stableConfig);
    expect(report.channel).toBe("development");
    expect(report.attention).toBeGreaterThan(0);
  });
});
