import { useEffect, useState } from "react";
import {
  ArchiveIcon,
  CheckIcon,
  DatabaseIcon,
  FileCheckIcon,
  KeyIcon,
  LockIcon,
  RefreshIcon,
  TrashIcon,
  UploadIcon,
  WarningIcon,
} from "@/components/shared/icons";
import { settingsContent } from "@/content/configuracoes";
import { formatFileSize, formatSettingsDateTime } from "@/lib/settings";
import type { BackupSettings, BackupSnapshot } from "@/types/configuracoes";
import type { BackupEncryptionMode, BackupHeader, BackupPreview } from "@/types/desktop-protection";

export type CreateBackupOptions = {
  mode: BackupEncryptionMode;
  password?: string;
};

function encryptionLabel(mode?: BackupEncryptionMode) {
  if (mode === "password") return "Senha própria";
  if (mode === "device") return "Protegido neste dispositivo";
  return "Sem criptografia";
}

export function BackupsPanel({
  settings,
  snapshots,
  restoreHeader,
  restorePreview,
  defaultMode,
  busy,
  onSettingsChange,
  onCreate,
  onRefresh,
  onRemove,
  onSelectRestore,
  onUnlockRestore,
  onPreviewSnapshot,
  onRestore,
  onOpenFolder,
}: {
  settings: BackupSettings;
  snapshots: BackupSnapshot[];
  restoreHeader: BackupHeader | null;
  restorePreview: BackupPreview | null;
  defaultMode: Extract<BackupEncryptionMode, "device" | "none">;
  busy: boolean;
  onSettingsChange: (value: BackupSettings) => void;
  onCreate: (options: CreateBackupOptions) => Promise<void>;
  onRefresh: () => Promise<void>;
  onRemove: (snapshot: BackupSnapshot) => Promise<void>;
  onSelectRestore: () => Promise<void>;
  onUnlockRestore: (password: string) => Promise<void>;
  onPreviewSnapshot: (snapshot: BackupSnapshot) => Promise<void>;
  onRestore: (password: string) => Promise<void>;
  onOpenFolder: () => Promise<void>;
}) {
  const [restoreConfirmation, setRestoreConfirmation] = useState("");
  const [restorePassword, setRestorePassword] = useState("");
  const [manualMode, setManualMode] = useState<BackupEncryptionMode>(defaultMode);
  const [manualPassword, setManualPassword] = useState("");
  const [manualConfirmation, setManualConfirmation] = useState("");
  const [manualError, setManualError] = useState("");

  useEffect(() => {
    setRestoreConfirmation("");
    setRestorePassword("");
  }, [restoreHeader?.filePath]);

  useEffect(() => {
    setManualMode((current) => current === "password" ? current : defaultMode);
  }, [defaultMode]);

  const statusLabel = (snapshot: BackupSnapshot) => {
    if (snapshot.status === "available") return settingsContent.backups.available;
    if (snapshot.status === "missing") return "Arquivo não encontrado";
    if (snapshot.status === "processing") return settingsContent.backups.processing;
    return settingsContent.backups.failed;
  };

  const kindLabel = (snapshot: BackupSnapshot) => {
    if (snapshot.kind === "pre_restore") return "Pré-restauração";
    return snapshot.automatic ? settingsContent.backups.automaticBadge : settingsContent.backups.manualBadge;
  };

  async function createBackup() {
    setManualError("");
    if (manualMode === "password") {
      if (manualPassword.length < 8 || manualPassword !== manualConfirmation) {
        setManualError("Crie uma senha com ao menos 8 caracteres e repita o mesmo valor.");
        return;
      }
    }
    await onCreate({ mode: manualMode, password: manualMode === "password" ? manualPassword : undefined });
    setManualPassword("");
    setManualConfirmation("");
  }

  return (
    <div className="backup-settings-layout phase-three-backup-layout">
      <section className="settings-panel backup-main-panel">
        <header className="settings-panel-header backup-panel-header">
          <div>
            <span className="section-eyebrow">Proteção local</span>
            <h2>{settingsContent.backups.title}</h2>
            <p>Backups novos podem ser criptografados com a chave deste computador ou com uma senha portátil escolhida por você.</p>
          </div>
          <div className="backup-header-actions">
            <button className="secondary-action-button" type="button" disabled={busy} onClick={() => void onRefresh()}><RefreshIcon /> Atualizar</button>
          </div>
        </header>

        <div className="manual-backup-builder">
          <div className="settings-subheading"><div><h3>Novo backup manual</h3><p>Escolha como proteger o arquivo antes de selecionar a pasta de destino.</p></div><LockIcon /></div>
          <div className="backup-encryption-options">
            <label className={manualMode === "device" ? "selected" : ""}>
              <input type="radio" name="manual-encryption" value="device" checked={manualMode === "device"} onChange={() => setManualMode("device")} />
              <span><LockIcon /></span><strong>Este dispositivo</strong><small>Chave aleatória guardada no Stronghold. Mais simples e recomendado para backups locais.</small>
            </label>
            <label className={manualMode === "password" ? "selected" : ""}>
              <input type="radio" name="manual-encryption" value="password" checked={manualMode === "password"} onChange={() => setManualMode("password")} />
              <span><KeyIcon /></span><strong>Senha portátil</strong><small>Pode ser restaurado em outro computador, desde que a senha seja conhecida.</small>
            </label>
            <label className={manualMode === "none" ? "selected warning" : "warning"}>
              <input type="radio" name="manual-encryption" value="none" checked={manualMode === "none"} onChange={() => setManualMode("none")} />
              <span><WarningIcon /></span><strong>Sem criptografia</strong><small>Compatível com a Fase 2, mas qualquer pessoa com o arquivo poderá tentar abrir o SQLite.</small>
            </label>
          </div>
          {manualMode === "password" ? (
            <div className="backup-password-grid">
              <label className="form-field settings-field"><span>Senha do backup</span><input type="password" autoComplete="new-password" value={manualPassword} onChange={(event) => setManualPassword(event.target.value)} /></label>
              <label className="form-field settings-field"><span>Confirmar senha</span><input type="password" autoComplete="new-password" value={manualConfirmation} onChange={(event) => setManualConfirmation(event.target.value)} /></label>
            </div>
          ) : null}
          {manualError ? <p className="backup-password-error"><WarningIcon /> {manualError}</p> : null}
          <button className="primary-action-button" type="button" disabled={busy} onClick={() => void createBackup()}><ArchiveIcon /> {busy ? "Processando..." : settingsContent.backups.create}</button>
        </div>

        <div className="backup-automatic-section">
          <div className="settings-subheading"><div><h3>{settingsContent.backups.automaticTitle}</h3><p>A verificação ocorre uma vez por abertura e cria a cópia somente quando o período estiver vencido.</p></div><DatabaseIcon /></div>
          <label className="settings-toggle-row">
            <span><strong>{settingsContent.backups.automatic}</strong><small>{settingsContent.backups.automaticHelper}</small></span>
            <input type="checkbox" checked={settings.automaticEnabled} onChange={(event) => onSettingsChange({ ...settings, automaticEnabled: event.target.checked })} />
            <i />
          </label>
          <div className="backup-settings-form phase-three-backup-settings-form">
            <label className="form-field settings-field"><span>{settingsContent.backups.frequency}</span><select disabled={!settings.automaticEnabled} value={settings.frequency} onChange={(event) => onSettingsChange({ ...settings, frequency: event.target.value as BackupSettings["frequency"] })}><option value="daily">{settingsContent.backups.daily}</option><option value="weekly">{settingsContent.backups.weekly}</option><option value="monthly">{settingsContent.backups.monthly}</option></select></label>
            <label className="form-field settings-field"><span>{settingsContent.backups.retention}</span><select disabled={!settings.automaticEnabled} value={settings.retentionCount} onChange={(event) => onSettingsChange({ ...settings, retentionCount: Number(event.target.value) })}>{[3, 6, 7, 12, 24, 30].map((count) => <option value={count} key={count}>{count} cópias</option>)}</select></label>
            <label className="form-field settings-field"><span>Proteção automática</span><select disabled={!settings.automaticEnabled} value={settings.encryptionMode} onChange={(event) => onSettingsChange({ ...settings, encryptionMode: event.target.value as BackupSettings["encryptionMode"] })}><option value="device">Criptografado neste dispositivo</option><option value="none">Sem criptografia</option></select></label>
          </div>
          <div className="backup-policy-note"><CheckIcon /><span>Backups automáticos criptografados usam uma chave exclusiva guardada no Stronghold. Eles não dependem da senha da conta para rodar em segundo plano.</span></div>
          {settings.lastAutomaticAt ? <small className="backup-last-run">Último automático: {formatSettingsDateTime(settings.lastAutomaticAt)}</small> : null}
        </div>

        <div className="backup-snapshots-section">
          <div className="settings-subheading"><div><h3>{settingsContent.backups.snapshotsTitle}</h3><p>{snapshots.length} cópias registradas no banco local</p></div><button className="text-action-button" type="button" onClick={() => void onOpenFolder()}>Abrir pasta automática</button></div>
          <div className="backup-snapshot-list">
            {snapshots.length === 0 ? (
              <div className="backup-empty-state"><ArchiveIcon /><strong>Nenhum backup criado</strong><span>Crie a primeira cópia antes de começar a acumular informações importantes.</span></div>
            ) : snapshots.map((snapshot) => (
              <article key={snapshot.id}>
                <span className="backup-file-icon">{snapshot.encryptionMode === "none" ? <ArchiveIcon /> : <LockIcon />}</span>
                <div className="backup-file-copy"><div><strong>{snapshot.fileName}</strong><span className={snapshot.automatic ? "automatic" : "manual"}>{kindLabel(snapshot)}</span><span className={`backup-encryption-badge ${snapshot.encryptionMode ?? "none"}`}>{encryptionLabel(snapshot.encryptionMode)}</span></div><small>{formatSettingsDateTime(snapshot.createdAt)} · {formatFileSize(snapshot.sizeBytes)} · {snapshot.modulesCount} documentos · schema {snapshot.schemaVersion ?? "-"}</small></div>
                <span className={`backup-status ${snapshot.status}`}>{snapshot.status === "available" ? <CheckIcon /> : snapshot.status === "processing" ? <RefreshIcon /> : <WarningIcon />}{statusLabel(snapshot)}</span>
                <div className="backup-actions">
                  <button type="button" title={settingsContent.backups.restore} disabled={snapshot.status !== "available" || busy} onClick={() => void onPreviewSnapshot(snapshot)}><RefreshIcon /></button>
                  <button type="button" title={settingsContent.backups.remove} disabled={busy} onClick={() => void onRemove(snapshot)}><TrashIcon /></button>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <aside className="backup-settings-sidebar">
        <section className="settings-panel restore-backup-card">
          <header className="settings-panel-header compact"><div><span className="section-eyebrow">.fuxbackup</span><h2>{settingsContent.backups.restoreTitle}</h2><p>O cabeçalho é lido antes da descriptografia para identificar qual credencial será necessária.</p></div><span className="settings-panel-icon"><UploadIcon /></span></header>
          <div className="restore-backup-body">
            <button className="secondary-action-button restore-file-button" type="button" disabled={busy} onClick={() => void onSelectRestore()}><UploadIcon /> {settingsContent.backups.selectFile}</button>
            {restoreHeader ? (
              <div className="restore-backup-header-card">
                <span>{restoreHeader.manifest.encryptionMode === "none" ? <ArchiveIcon /> : <LockIcon />}</span>
                <div><strong>{restoreHeader.fileName}</strong><small>{encryptionLabel(restoreHeader.manifest.encryptionMode)}</small><small>{formatFileSize(restoreHeader.packageSizeBytes)} · schema {restoreHeader.manifest.schemaVersion}</small></div>
              </div>
            ) : null}
            {restoreHeader?.manifest.encryptionMode === "password" && !restorePreview ? (
              <div className="restore-password-unlock">
                <label className="form-field"><span>Senha do arquivo</span><input type="password" value={restorePassword} onChange={(event) => setRestorePassword(event.target.value)} /></label>
                <button className="secondary-action-button" type="button" disabled={busy || restorePassword.length < 1} onClick={() => void onUnlockRestore(restorePassword)}><KeyIcon /> Validar backup</button>
              </div>
            ) : null}
            {restorePreview ? (
              <div className={`restore-file-result ${restorePreview.compatible ? "valid" : "invalid"}`}>
                <span>{restorePreview.compatible ? <FileCheckIcon /> : <WarningIcon />}</span>
                <div><strong>{restorePreview.fileName}</strong><small>{restorePreview.compatibilityMessage}</small><small>{formatSettingsDateTime(restorePreview.manifest.createdAt)} · {formatFileSize(restorePreview.packageSizeBytes)} · versão {restorePreview.manifest.appVersion}</small></div>
              </div>
            ) : null}
            {restorePreview?.compatible ? (
              <label className="form-field restore-confirmation-field"><span>Digite RESTAURAR para confirmar</span><input value={restoreConfirmation} onChange={(event) => setRestoreConfirmation(event.target.value.toUpperCase())} placeholder="RESTAURAR" /></label>
            ) : null}
            <button className="primary-action-button restore-confirm-button" type="button" disabled={!restorePreview?.compatible || restoreConfirmation !== "RESTAURAR" || busy} onClick={() => void onRestore(restorePassword)}><RefreshIcon /> {busy ? "Restaurando..." : settingsContent.backups.confirmRestore}</button>
          </div>
        </section>

        <section className="settings-panel backup-safety-card">
          <header className="settings-panel-header compact"><div><span className="section-eyebrow">Garantias</span><h2>Restauração protegida</h2></div><span className="settings-panel-icon"><CheckIcon /></span></header>
          <ul>
            <li><CheckIcon /> AES-256-GCM nos backups protegidos</li>
            <li><CheckIcon /> Derivação Argon2id para senha portátil</li>
            <li><CheckIcon /> Checksum SHA-256 do conteúdo</li>
            <li><CheckIcon /> PRAGMA integrity_check</li>
            <li><CheckIcon /> PRAGMA foreign_key_check</li>
            <li><CheckIcon /> Backup preventivo antes da troca</li>
            <li><CheckIcon /> Reversão se a validação final falhar</li>
          </ul>
        </section>

        <section className="settings-panel backup-privacy-card">
          <header className="settings-panel-header compact"><div><span className="section-eyebrow">Importante</span><h2>Não perca a senha portátil</h2></div><span className="settings-panel-icon"><KeyIcon /></span></header>
          <p>O FinnacialUX não consegue recuperar uma senha criada especificamente para o backup. Guarde-a fora do computador junto da cópia.</p>
        </section>
      </aside>
    </div>
  );
}
