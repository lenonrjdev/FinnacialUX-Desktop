import { useState } from "react";
import {
  ArchiveIcon,
  CheckIcon,
  DatabaseIcon,
  FileCheckIcon,
  RefreshIcon,
  TrashIcon,
  UploadIcon,
  WarningIcon,
} from "@/components/shared/icons";
import { settingsContent } from "@/content/configuracoes";
import { formatFileSize, formatSettingsDateTime } from "@/lib/settings";
import type { BackupSettings, BackupSnapshot } from "@/types/configuracoes";
import type { BackupPreview } from "@/types/desktop-protection";

export function BackupsPanel({
  settings,
  snapshots,
  restorePreview,
  busy,
  onSettingsChange,
  onCreate,
  onRefresh,
  onRemove,
  onSelectRestore,
  onPreviewSnapshot,
  onRestore,
  onOpenFolder,
}: {
  settings: BackupSettings;
  snapshots: BackupSnapshot[];
  restorePreview: BackupPreview | null;
  busy: boolean;
  onSettingsChange: (value: BackupSettings) => void;
  onCreate: () => Promise<void>;
  onRefresh: () => Promise<void>;
  onRemove: (snapshot: BackupSnapshot) => Promise<void>;
  onSelectRestore: () => Promise<void>;
  onPreviewSnapshot: (snapshot: BackupSnapshot) => Promise<void>;
  onRestore: () => Promise<void>;
  onOpenFolder: () => Promise<void>;
}) {
  const [restoreConfirmation, setRestoreConfirmation] = useState("");

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

  return (
    <div className="backup-settings-layout">
      <section className="settings-panel backup-main-panel">
        <header className="settings-panel-header backup-panel-header">
          <div>
            <span className="section-eyebrow">Proteção local</span>
            <h2>{settingsContent.backups.title}</h2>
            <p>Cada arquivo contém uma cópia consistente do SQLite, manifesto de versão e checksum SHA-256 para detectar corrupção.</p>
          </div>
          <div className="backup-header-actions">
            <button className="secondary-action-button" type="button" disabled={busy} onClick={() => void onRefresh()}><RefreshIcon /> Atualizar</button>
            <button className="primary-action-button" type="button" disabled={busy} onClick={() => void onCreate()}><ArchiveIcon /> {busy ? "Processando..." : settingsContent.backups.create}</button>
          </div>
        </header>

        <div className="backup-automatic-section">
          <div className="settings-subheading"><div><h3>{settingsContent.backups.automaticTitle}</h3><p>A verificação ocorre uma vez por abertura do aplicativo e cria a cópia somente quando o período estiver vencido.</p></div><DatabaseIcon /></div>
          <label className="settings-toggle-row">
            <span><strong>{settingsContent.backups.automatic}</strong><small>{settingsContent.backups.automaticHelper}</small></span>
            <input type="checkbox" checked={settings.automaticEnabled} onChange={(event) => onSettingsChange({ ...settings, automaticEnabled: event.target.checked })} />
            <i />
          </label>
          <div className="backup-settings-form">
            <label className="form-field settings-field"><span>{settingsContent.backups.frequency}</span><select disabled={!settings.automaticEnabled} value={settings.frequency} onChange={(event) => onSettingsChange({ ...settings, frequency: event.target.value as BackupSettings["frequency"] })}><option value="daily">{settingsContent.backups.daily}</option><option value="weekly">{settingsContent.backups.weekly}</option><option value="monthly">{settingsContent.backups.monthly}</option></select></label>
            <label className="form-field settings-field"><span>{settingsContent.backups.retention}</span><select disabled={!settings.automaticEnabled} value={settings.retentionCount} onChange={(event) => onSettingsChange({ ...settings, retentionCount: Number(event.target.value) })}>{[3, 6, 7, 12, 24, 30].map((count) => <option value={count} key={count}>{count} cópias</option>)}</select></label>
          </div>
          <div className="backup-policy-note"><CheckIcon /><span>Backups automáticos ficam na pasta protegida do FinnacialUX. Ao exceder a retenção, somente as cópias automáticas mais antigas são removidas.</span></div>
          {settings.lastAutomaticAt ? <small className="backup-last-run">Último automático: {formatSettingsDateTime(settings.lastAutomaticAt)}</small> : null}
        </div>

        <div className="backup-snapshots-section">
          <div className="settings-subheading"><div><h3>{settingsContent.backups.snapshotsTitle}</h3><p>{snapshots.length} cópias registradas no banco local</p></div><button className="text-action-button" type="button" onClick={() => void onOpenFolder()}>Abrir pasta automática</button></div>
          <div className="backup-snapshot-list">
            {snapshots.length === 0 ? (
              <div className="backup-empty-state"><ArchiveIcon /><strong>Nenhum backup criado</strong><span>Crie a primeira cópia antes de começar a acumular informações importantes.</span></div>
            ) : snapshots.map((snapshot) => (
              <article key={snapshot.id}>
                <span className="backup-file-icon"><ArchiveIcon /></span>
                <div className="backup-file-copy"><div><strong>{snapshot.fileName}</strong><span className={snapshot.automatic ? "automatic" : "manual"}>{kindLabel(snapshot)}</span></div><small>{formatSettingsDateTime(snapshot.createdAt)} · {formatFileSize(snapshot.sizeBytes)} · {snapshot.modulesCount} documentos · schema {snapshot.schemaVersion ?? "-"}</small></div>
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
          <header className="settings-panel-header compact"><div><span className="section-eyebrow">.fuxbackup</span><h2>{settingsContent.backups.restoreTitle}</h2><p>O arquivo é validado antes de qualquer substituição. Uma cópia preventiva do banco atual será criada automaticamente.</p></div><span className="settings-panel-icon"><UploadIcon /></span></header>
          <div className="restore-backup-body">
            <button className="secondary-action-button restore-file-button" type="button" disabled={busy} onClick={() => void onSelectRestore()}><UploadIcon /> {settingsContent.backups.selectFile}</button>
            {restorePreview ? (
              <div className={`restore-file-result ${restorePreview.compatible ? "valid" : "invalid"}`}>
                <span>{restorePreview.compatible ? <FileCheckIcon /> : <WarningIcon />}</span>
                <div><strong>{restorePreview.fileName}</strong><small>{restorePreview.compatibilityMessage}</small><small>{formatSettingsDateTime(restorePreview.manifest.createdAt)} · {formatFileSize(restorePreview.packageSizeBytes)} · versão {restorePreview.manifest.appVersion}</small></div>
              </div>
            ) : null}
            {restorePreview?.compatible ? (
              <label className="form-field restore-confirmation-field"><span>Digite RESTAURAR para confirmar</span><input value={restoreConfirmation} onChange={(event) => setRestoreConfirmation(event.target.value.toUpperCase())} placeholder="RESTAURAR" /></label>
            ) : null}
            <button className="primary-action-button restore-confirm-button" type="button" disabled={!restorePreview?.compatible || restoreConfirmation !== "RESTAURAR" || busy} onClick={() => void onRestore()}><RefreshIcon /> {busy ? "Restaurando..." : settingsContent.backups.confirmRestore}</button>
          </div>
        </section>

        <section className="settings-panel backup-safety-card">
          <header className="settings-panel-header compact"><div><span className="section-eyebrow">Garantias</span><h2>Restauração protegida</h2></div><span className="settings-panel-icon"><CheckIcon /></span></header>
          <ul>
            <li><CheckIcon /> Verificação SHA-256 do conteúdo</li>
            <li><CheckIcon /> PRAGMA integrity_check</li>
            <li><CheckIcon /> PRAGMA foreign_key_check</li>
            <li><CheckIcon /> Compatibilidade do schema</li>
            <li><CheckIcon /> Backup antes da substituição</li>
            <li><CheckIcon /> Reversão se a validação final falhar</li>
          </ul>
        </section>

        <section className="settings-panel backup-privacy-card">
          <header className="settings-panel-header compact"><div><span className="section-eyebrow">Privacidade</span><h2>Armazenamento local</h2></div><span className="settings-panel-icon"><DatabaseIcon /></span></header>
          <p>Backups manuais são salvos somente no local que você escolher. Backups automáticos permanecem na pasta privada do aplicativo neste computador.</p>
        </section>
      </aside>
    </div>
  );
}
