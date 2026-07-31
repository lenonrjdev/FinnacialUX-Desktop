"use client";

import { getVersion } from "@tauri-apps/api/app";
import { useCallback, useEffect, useState } from "react";
import {
  ArchiveIcon,
  CheckIcon,
  CopyIcon,
  FileCheckIcon,
  RefreshIcon,
  ShieldIcon,
  WarningIcon,
} from "@/components/shared/icons";
import { getDatabaseEncryptionStatus } from "@/lib/desktop/database";
import { getDesktopUpdaterStatus } from "@/lib/desktop/updater";
import {
  createReleaseReadinessReport,
  formatReleaseReadinessSummary,
  stableReleaseConfig,
} from "@/lib/release-candidate";
import type { ReleaseSnapshot } from "@/types/release-candidate";

const browserFallback: ReleaseSnapshot = {
  version: stableReleaseConfig.version,
  schemaVersion: stableReleaseConfig.schemaVersion,
  updaterConfigured: false,
  developmentBuild: true,
  backupBeforeInstall: true,
  windowsRuntime: typeof navigator !== "undefined" && /Windows/i.test(navigator.userAgent),
};

export function ReleaseCandidatePanel({ onFeedback }: { onFeedback: (message: string) => void }) {
  const [snapshot, setSnapshot] = useState<ReleaseSnapshot>(browserFallback);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [version, database, updater] = await Promise.all([
        getVersion(),
        getDatabaseEncryptionStatus(true),
        getDesktopUpdaterStatus(),
      ]);
      setSnapshot({
        version,
        schemaVersion: database.schemaVersion,
        updaterConfigured: updater.configured,
        developmentBuild: updater.developmentBuild,
        backupBeforeInstall: updater.preferences.backupBeforeInstall,
        windowsRuntime: /Windows/i.test(navigator.userAgent),
      });
    } catch (caught) {
      setSnapshot(browserFallback);
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const report = createReleaseReadinessReport(snapshot);

  async function copySummary() {
    try {
      await navigator.clipboard.writeText(formatReleaseReadinessSummary(report));
      onFeedback("Resumo da versão estável copiado.");
    } catch {
      setError("Não foi possível copiar o resumo da versão estável.");
    }
  }

  return (
    <section className="settings-section release-candidate-panel">
      <div className="settings-section-heading">
        <div>
          <span className="section-eyebrow">Canal estável e suporte</span>
          <h2>FinnacialUX Desktop 1.1</h2>
          <p>Confirme versão, schema congelado, updater e backup para manter as próximas atualizações protegidas.</p>
        </div>
        <button className="secondary-action-button" type="button" disabled={loading} onClick={() => void refresh()}>
          <RefreshIcon /> {loading ? "Verificando..." : "Atualizar estado"}
        </button>
      </div>

      <div className={`release-candidate-summary ${report.ready ? "ready" : "blocked"}`}>
        <div className="release-candidate-badge">{report.ready ? <CheckIcon /> : <WarningIcon />}</div>
        <div>
          <span>{report.ready ? "Versão estável íntegra" : "Existem pendências"}</span>
          <h3>{stableReleaseConfig.version}</h3>
          <p>Schema {stableReleaseConfig.schemaVersion} congelado · promovida de {report.promotedFrom}</p>
        </div>
        <strong>{report.passed}/{report.checks.length}</strong>
      </div>

      <div className="release-candidate-checks">
        {report.checks.map((item) => (
          <article className={item.status} key={item.id}>
            <div>{item.status === "passed" ? <CheckIcon /> : item.status === "attention" ? <ShieldIcon /> : <WarningIcon />}</div>
            <span><strong>{item.title}</strong><small>{item.detail}</small></span>
          </article>
        ))}
      </div>

      <div className="release-candidate-artifacts">
        <div><FileCheckIcon /><span><strong>Instalador estável</strong><code>{report.assetName}</code></span></div>
        <div><ArchiveIcon /><span><strong>Publicação oficial</strong><small>Release estável marcada como Latest, com SHA-256 e assinatura do updater.</small></span></div>
      </div>

      <div className="release-candidate-actions">
        <button className="secondary-action-button" type="button" onClick={() => void copySummary()}><CopyIcon /> Copiar resumo</button>
        <button className="text-action-button" type="button" onClick={() => { window.location.hash = "diagnostico"; }}><ShieldIcon /> Abrir diagnóstico</button>
      </div>

      {error ? <div className="updates-dev-notice"><WarningIcon /><div><strong>Prévia limitada</strong><p>{error}</p></div></div> : null}
    </section>
  );
}
