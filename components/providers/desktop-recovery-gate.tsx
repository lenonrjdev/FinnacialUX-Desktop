"use client";

import { useEffect, useState } from "react";
import {
  ArchiveIcon,
  CheckIcon,
  DatabaseIcon,
  KeyIcon,
  LockIcon,
  RefreshIcon,
  ShieldIcon,
  WarningIcon,
} from "@/components/shared/icons";
import { isDesktopRuntime } from "@/lib/desktop/database";
import {
  acknowledgeRecovery,
  chooseBackupSource,
  getRecoveryStatus,
  inspectNativeBackup,
  previewNativeBackup,
  restoreNativeBackup,
  runDatabaseIntegrityCheck,
  setSafeModeEnabled,
} from "@/lib/desktop/protection";
import { ensureDeviceBackupKey } from "@/lib/desktop/stronghold";
import type { BackupHeader, BackupPreview, IntegrityReport } from "@/types/desktop-protection";

export function DesktopRecoveryGate({ children }: { children: React.ReactNode }) {
  const [checking, setChecking] = useState(true);
  const [recoveryRequired, setRecoveryRequired] = useState(false);
  const [integrity, setIntegrity] = useState<IntegrityReport | null>(null);
  const [header, setHeader] = useState<BackupHeader | null>(null);
  const [preview, setPreview] = useState<BackupPreview | null>(null);
  const [backupPassword, setBackupPassword] = useState("");
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

  async function resolveCredential(current: BackupHeader, password?: string) {
    if (current.manifest.encryptionMode === "device") return ensureDeviceBackupKey();
    if (current.manifest.encryptionMode === "password") {
      if (!password) throw new Error("Digite a senha usada para proteger este backup.");
      return password;
    }
    return undefined;
  }

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

  async function validateBackup(current: BackupHeader, password?: string) {
    const credential = await resolveCredential(current, password);
    setPreview(await previewNativeBackup(current.filePath, credential));
  }

  async function selectBackup() {
    setBusy(true);
    setError("");
    setPreview(null);
    setHeader(null);
    setBackupPassword("");
    try {
      const source = await chooseBackupSource();
      if (!source) return;
      const selectedHeader = await inspectNativeBackup(source);
      setHeader(selectedHeader);
      if (selectedHeader.manifest.encryptionMode !== "password") {
        await validateBackup(selectedHeader);
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setBusy(false);
    }
  }

  async function unlockBackup() {
    if (!header) return;
    setBusy(true);
    setError("");
    try {
      await validateBackup(header, backupPassword);
    } catch (caught) {
      setPreview(null);
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setBusy(false);
    }
  }

  async function restoreSelectedBackup() {
    if (!preview?.compatible || !header) return;
    setBusy(true);
    setError("");
    try {
      const credential = await resolveCredential(header, backupPassword);
      const safetyCredential = await ensureDeviceBackupKey();
      await restoreNativeBackup(preview.filePath, credential, safetyCredential);
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
            <div><strong>{integrity.ok ? "Banco local íntegro" : "A verificação encontrou um problema"}</strong><span>Schema {integrity.schemaVersion} · {integrity.foreignKeyViolations} violações de relacionamento</span></div>
          </div>
        ) : null}

        {header ? (
          <div className="desktop-recovery-result backup-header">
            {header.manifest.encryptionMode === "none" ? <ArchiveIcon /> : <LockIcon />}
            <div><strong>{header.fileName}</strong><span>{header.manifest.encryptionMode === "password" ? "Protegido por senha portátil" : header.manifest.encryptionMode === "device" ? "Protegido neste dispositivo" : "Backup sem criptografia"}</span></div>
          </div>
        ) : null}

        {header?.manifest.encryptionMode === "password" && !preview ? (
          <div className="desktop-recovery-password">
            <label className="form-field"><span>Senha do backup</span><input type="password" value={backupPassword} onChange={(event) => setBackupPassword(event.target.value)} /></label>
            <button className="secondary-action-button" type="button" disabled={busy || !backupPassword} onClick={() => void unlockBackup()}><KeyIcon /> Validar arquivo</button>
          </div>
        ) : null}

        {preview ? (
          <div className={`desktop-recovery-result ${preview.compatible ? "ok" : "failed"}`}>
            {preview.compatible ? <ArchiveIcon /> : <WarningIcon />}
            <div><strong>{preview.fileName}</strong><span>{preview.compatibilityMessage}</span></div>
          </div>
        ) : null}

        {error ? <div className="desktop-recovery-error">{error}</div> : null}

        <div className="desktop-recovery-actions">
          <button type="button" className="primary-action-button" disabled={busy} onClick={() => void continueNormally()}><RefreshIcon /> Abrir normalmente</button>
          <button type="button" className="secondary-action-button" disabled={busy} onClick={() => void verifyDatabase()}><DatabaseIcon /> Verificar banco</button>
          <button type="button" className="secondary-action-button" disabled={busy} onClick={() => void selectBackup()}><ArchiveIcon /> Selecionar backup</button>
          <button type="button" className="secondary-action-button" disabled={busy} onClick={() => void openSafeMode()}><ShieldIcon /> Abrir em modo seguro</button>
        </div>

        {preview?.compatible ? (
          <div className="desktop-recovery-restore-confirmation">
            <div><strong>Restaurar esta cópia?</strong><span>Antes da substituição, o FinnacialUX criará um backup criptografado do banco atual.</span></div>
            <button type="button" className="primary-action-button" disabled={busy} onClick={() => void restoreSelectedBackup()}><ArchiveIcon /> Restaurar e reiniciar</button>
          </div>
        ) : null}

        <footer>O modo seguro permite consultar informações, mas bloqueia qualquer alteração financeira nesta sessão.</footer>
      </section>
    </main>
  );
}
