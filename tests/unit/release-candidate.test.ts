import { describe, expect, it } from "vitest";
import {
  createReleaseReadinessReport,
  parseDesktopVersion,
  releaseAssetName,
  releaseChannel,
  releaseTag,
} from "@/lib/release-candidate";

const readySnapshot = {
  version: "0.18.0-rc.1",
  schemaVersion: 14,
  updaterConfigured: true,
  developmentBuild: false,
  backupBeforeInstall: true,
  windowsRuntime: true,
};

describe("release candidate", () => {
  it("interpreta a versão candidata", () => {
    expect(parseDesktopVersion("0.18.0-rc.1")).toEqual({
      valid: true,
      major: 0,
      minor: 18,
      patch: 0,
      prerelease: "rc.1",
    });
  });

  it("distingue desenvolvimento, candidato e estável", () => {
    expect(releaseChannel("0.18.0-rc.1")).toBe("release-candidate");
    expect(releaseChannel("1.0.0")).toBe("stable");
    expect(releaseChannel("0.18.0-rc.1", true)).toBe("development");
  });

  it("gera nomes determinísticos de tag e instalador", () => {
    expect(releaseTag("0.18.0-rc.1")).toBe("desktop-v0.18.0-rc.1");
    expect(releaseAssetName("0.18.0-rc.1")).toBe("FinnacialUX-Desktop_0.18.0-rc.1_x64-setup.exe");
  });

  it("aprova somente o candidato com schema congelado e proteções ativas", () => {
    const report = createReleaseReadinessReport(readySnapshot);
    expect(report.ready).toBe(true);
    expect(report.blocked).toBe(0);
    expect(report.channel).toBe("release-candidate");
  });

  it("bloqueia divergência de schema", () => {
    const report = createReleaseReadinessReport({ ...readySnapshot, schemaVersion: 15 });
    expect(report.ready).toBe(false);
    expect(report.checks.find((item) => item.id === "schema")?.status).toBe("blocked");
  });

  it("bloqueia publicação sem updater e backup pré-atualização", () => {
    const report = createReleaseReadinessReport({
      ...readySnapshot,
      updaterConfigured: false,
      backupBeforeInstall: false,
    });
    expect(report.ready).toBe(false);
    expect(report.blocked).toBe(2);
  });

  it("trata o modo de desenvolvimento como atenção sem falsificar o canal", () => {
    const report = createReleaseReadinessReport({ ...readySnapshot, developmentBuild: true });
    expect(report.channel).toBe("development");
    expect(report.attention).toBeGreaterThan(0);
  });
});
