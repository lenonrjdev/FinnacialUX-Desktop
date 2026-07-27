"use client";

import { useEffect, useState } from "react";
import {
  ArchiveIcon,
  CheckIcon,
  DatabaseIcon,
  RefreshIcon,
  ShieldIcon,
  WarningIcon,
} from "@/components/shared/icons";
import { isDesktopRuntime } from "@/lib/desktop/database";
import {
  acknowledgeRecovery,
  chooseBackupSource,
  getRecoveryStatus,
  previewNativeBackup,
  restoreNativeBackup,
  runDatabaseIntegrityCheck,
  setSafeModeEnabled,
} from "@/lib/desktop/protection";
import type { BackupPreview, IntegrityReport } from "@/types/desktop-protection";

export function DesktopRecoveryGate({ children }: { children: React.ReactNode }) {
  const [checking, setChecking] = useState(true);
  const [recoveryRequired, setRecoveryRequired] = useState(false);
  const [integrity, setIntegrity] = useState<IntegrityReport | null>(null);
  const [preview, setPreview] = useState<BackupPreview | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isDesktopRuntime()) {
      setChecking(false);
      return;
    }
    void getRecoveryStatus()
      .then((status) => setRecoveryRequired(status.previousUncleanShutdown))
      .catch(() => setRecoveryRequired(false))
      .finally(() => setChecking(false));
  }, []);

  async function continueNormally() {
    setBusy(true);
    try {
      await acknowledgeRecovery();
      setSafeModeEnabled(false);
      setRecoveryRequired(false);
    } finally {
      setBusy(false);
    }
  }

  async function verifyDatabase() {
    setBusy(true);
    setError("");
    try {
      setIntegrity(await runDatabaseIntegrityCheck());
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setBusy(false);
    }
  }

  async function selectBackup() {
    setBusy(true);
    setError("");
    try {
      const source = await chooseBackupSource();
      if (!source) return;
      setPreview(await previewNativeBackup(source));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setBusy(false);
    }
  }

  async function restoreSelectedBackup() {
    if (!preview?.compatible) return;
    setBusy(true);
    setError("");
    try {
      await restoreNativeBackup(preview.filePath);
      window.location.replace("/login/");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
      setBusy(false);
    }
  }

  async function openSafeMode() {
    setBusy(true);
    try {
      setSafeModeEnabled(true);
      await acknowledgeRecovery();
      setRecoveryRequired(false);
    } finally {
      setBusy(false);
    }
  }

  if (checking) {
    return <div className="desktop-recovery-loading" aria-label="Verificando a inicialização do FinnacialUX" />;
  }

  if (!recoveryRequired) return children;

  return (
    <main className="desktop-recovery-screen">
      <section className="desktop-recovery-card" role="alertdialog" aria-modal="true" aria-labelledby="recovery-title">
        <header>
          <span className="desktop-recovery-icon"><WarningIcon /></span>
          <div>
            <span className="section-eyebrow">Proteção de dados</span>
            <h1 id="recovery-title">O FinnacialUX não foi encerrado normalmente</h1>
            <p>Isso pode acontecer após queda de energia, encerramento forçado ou reinicialização do Windows. Seus dados não serão alterados até você escolher como continuar.</p>
          </div>
        </header>

        {integrity ? (
          <div className={`desktop-recovery-result ${integrity.ok ? "ok" : "failed"}`}>
            {integrity.ok ? <CheckIcon /> : <WarningIcon />}
            <div>
              <strong>{integrity.ok ? "Banco local íntegro" : "A verificação encontrou um problema"}</strong>
              <span>Schema {integrity.schemaVersion} · {integrity.foreignKeyViolations} violações de relacionamento</span>
            </div>
          </div>
        ) : null}

        {preview ? (
          <div className={`desktop-recovery-result ${preview.compatible ? "ok" : "failed"}`}>
            {preview.compatible ? <ArchiveIcon /> : <WarningIcon />}
            <div>
              <strong>{preview.fileName}</strong>
              <span>{preview.compatibilityMessage}</span>
            </div>
          </div>
        ) : null}

        {error ? <div className="desktop-recovery-error">{error}</div> : null}

        <div className="desktop-recovery-actions">
          <button type="button" className="primary-action-button" disabled={busy} onClick={() => void continueNormally()}>
            <RefreshIcon /> Abrir normalmente
          </button>
          <button type="button" className="secondary-action-button" disabled={busy} onClick={() => void verifyDatabase()}>
            <DatabaseIcon /> Verificar banco
          </button>
          <button type="button" className="secondary-action-button" disabled={busy} onClick={() => void selectBackup()}>
            <ArchiveIcon /> Selecionar backup
          </button>
          <button type="button" className="secondary-action-button" disabled={busy} onClick={() => void openSafeMode()}>
            <ShieldIcon /> Abrir em modo seguro
          </button>
        </div>

        {preview?.compatible ? (
          <div className="desktop-recovery-restore-confirmation">
            <div>
              <strong>Restaurar esta cópia?</strong>
              <span>Antes da substituição, o FinnacialUX criará automaticamente um backup do banco atual.</span>
            </div>
            <button type="button" className="primary-action-button" disabled={busy} onClick={() => void restoreSelectedBackup()}>
              <ArchiveIcon /> Restaurar e reiniciar
            </button>
          </div>
        ) : null}

        <footer>O modo seguro permite consultar informações, mas bloqueia qualquer alteração financeira nesta sessão.</footer>
      </section>
    </main>
  );
}
