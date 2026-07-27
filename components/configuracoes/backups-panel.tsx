import { useRef, useState } from "react";
import {
  ArchiveIcon,
  CheckIcon,
  DatabaseIcon,
  DownloadIcon,
  FileCheckIcon,
  RefreshIcon,
  TrashIcon,
  UploadIcon,
  WarningIcon,
} from "@/components/shared/icons";
import { settingsContent } from "@/content/configuracoes";
import { downloadTextFile } from "@/lib/data-tools";
import { formatFileSize, formatSettingsDateTime, isValidFinanceBackup } from "@/lib/settings";
import type { BackupSettings, BackupSnapshot } from "@/types/configuracoes";

export function BackupsPanel({
  settings,
  snapshots,
  onSettingsChange,
  onCreate,
  onRemove,
  onRestore,
  onDeleteAccount,
}: {
  settings: BackupSettings;
  snapshots: BackupSnapshot[];
  onSettingsChange: (value: BackupSettings) => void;
  onCreate: () => void;
  onRemove: (id: string) => void;
  onRestore: (payload: unknown) => void;
  onDeleteAccount: () => void;
}) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [restoreFile, setRestoreFile] = useState<{ name: string; payload: unknown; valid: boolean } | null>(null);
  const [deleteConfirmation, setDeleteConfirmation] = useState("");

  async function selectRestoreFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const payload = JSON.parse(await file.text());
      setRestoreFile({ name: file.name, payload, valid: isValidFinanceBackup(payload) });
    } catch {
      setRestoreFile({ name: file.name, payload: null, valid: false });
    }
    event.target.value = "";
  }

  function downloadSnapshot(snapshot: BackupSnapshot) {
    downloadTextFile(JSON.stringify({ generatedAt: snapshot.createdAt, version: "snapshot-demo", snapshot }, null, 2), snapshot.fileName, "application/json;charset=utf-8");
  }

  return (
    <div className="backup-settings-layout">
      <section className="settings-panel backup-main-panel">
        <header className="settings-panel-header backup-panel-header">
          <div>
            <span className="section-eyebrow">{settingsContent.views.backups}</span>
            <h2>{settingsContent.backups.title}</h2>
            <p>{settingsContent.backups.description}</p>
          </div>
          <button className="primary-action-button" type="button" onClick={onCreate}><ArchiveIcon /> {settingsContent.backups.create}</button>
        </header>

        <div className="backup-automatic-section">
          <div className="settings-subheading"><div><h3>{settingsContent.backups.automaticTitle}</h3></div><DatabaseIcon /></div>
          <label className="settings-toggle-row">
            <span><strong>{settingsContent.backups.automatic}</strong><small>{settingsContent.backups.automaticHelper}</small></span>
            <input type="checkbox" checked={settings.automaticEnabled} onChange={(event) => onSettingsChange({ ...settings, automaticEnabled: event.target.checked })} />
            <i />
          </label>
          <div className="backup-settings-form">
            <label className="form-field settings-field"><span>{settingsContent.backups.frequency}</span><select disabled={!settings.automaticEnabled} value={settings.frequency} onChange={(event) => onSettingsChange({ ...settings, frequency: event.target.value as BackupSettings["frequency"] })}><option value="daily">{settingsContent.backups.daily}</option><option value="weekly">{settingsContent.backups.weekly}</option><option value="monthly">{settingsContent.backups.monthly}</option></select></label>
            <label className="form-field settings-field"><span>{settingsContent.backups.retention}</span><select disabled={!settings.automaticEnabled} value={settings.retentionCount} onChange={(event) => onSettingsChange({ ...settings, retentionCount: Number(event.target.value) })}>{[3, 6, 12, 24].map((count) => <option value={count} key={count}>{count} cópias</option>)}</select></label>
          </div>
          <label className="settings-toggle-row compact backup-attachment-toggle"><span><strong>{settingsContent.backups.attachments}</strong><small>{settingsContent.backups.attachmentsHelper}</small></span><input type="checkbox" checked={settings.includeAttachments} onChange={(event) => onSettingsChange({ ...settings, includeAttachments: event.target.checked })} /><i /></label>
        </div>

        <div className="backup-snapshots-section">
          <div className="settings-subheading"><div><h3>{settingsContent.backups.snapshotsTitle}</h3><p>{snapshots.length} cópias registradas</p></div></div>
          <div className="backup-snapshot-list">
            {snapshots.map((snapshot) => (
              <article key={snapshot.id}>
                <span className="backup-file-icon"><ArchiveIcon /></span>
                <div className="backup-file-copy"><div><strong>{snapshot.fileName}</strong><span className={snapshot.automatic ? "automatic" : "manual"}>{snapshot.automatic ? settingsContent.backups.automaticBadge : settingsContent.backups.manualBadge}</span></div><small>{formatSettingsDateTime(snapshot.createdAt)} · {formatFileSize(snapshot.sizeBytes)} · {snapshot.modulesCount} módulos</small></div>
                <span className={`backup-status ${snapshot.status}`}>{snapshot.status === "available" ? <CheckIcon /> : snapshot.status === "processing" ? <RefreshIcon /> : <WarningIcon />}{settingsContent.backups[snapshot.status]}</span>
                <div className="backup-actions"><button type="button" title={settingsContent.backups.download} onClick={() => downloadSnapshot(snapshot)}><DownloadIcon /></button><button type="button" title={settingsContent.backups.restore} onClick={() => onRestore({ generatedAt: snapshot.createdAt, transactions: [], accounts: [], cards: {} })}><RefreshIcon /></button><button type="button" title={settingsContent.backups.remove} onClick={() => onRemove(snapshot.id)}><TrashIcon /></button></div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <aside className="backup-settings-sidebar">
        <section className="settings-panel restore-backup-card">
          <header className="settings-panel-header compact"><div><span className="section-eyebrow">JSON</span><h2>{settingsContent.backups.restoreTitle}</h2><p>{settingsContent.backups.restoreDescription}</p></div><span className="settings-panel-icon"><UploadIcon /></span></header>
          <div className="restore-backup-body">
            <input ref={fileInputRef} type="file" accept="application/json,.json" hidden onChange={selectRestoreFile} />
            <button className="secondary-action-button restore-file-button" type="button" onClick={() => fileInputRef.current?.click()}><UploadIcon /> {settingsContent.backups.selectFile}</button>
            {restoreFile ? <div className={`restore-file-result ${restoreFile.valid ? "valid" : "invalid"}`}><span>{restoreFile.valid ? <FileCheckIcon /> : <WarningIcon />}</span><div><strong>{restoreFile.name}</strong><small>{restoreFile.valid ? settingsContent.backups.validFile : settingsContent.backups.invalidFile}</small></div></div> : null}
            <button className="primary-action-button restore-confirm-button" type="button" disabled={!restoreFile?.valid} onClick={() => restoreFile && onRestore(restoreFile.payload)}><RefreshIcon /> {settingsContent.backups.confirmRestore}</button>
          </div>
        </section>

        <section className="settings-panel danger-data-card">
          <header className="settings-panel-header compact"><div><span className="section-eyebrow">Privacidade</span><h2>{settingsContent.backups.dangerTitle}</h2></div><span className="settings-panel-icon danger"><WarningIcon /></span></header>
          <div className="danger-data-actions">
            <article><div><strong>{settingsContent.backups.exportAll}</strong><p>{settingsContent.backups.exportAllHelper}</p></div><button type="button" onClick={onCreate}><DownloadIcon /></button></article>
            <article className="delete-account-action"><div><strong>{settingsContent.backups.deleteAccount}</strong><p>{settingsContent.backups.deleteAccountHelper}</p></div><input value={deleteConfirmation} placeholder="EXCLUIR" onChange={(event) => setDeleteConfirmation(event.target.value)} /><button type="button" disabled={deleteConfirmation !== "EXCLUIR"} onClick={() => { onDeleteAccount(); setDeleteConfirmation(""); }}><TrashIcon /> {settingsContent.backups.deleteAccount}</button></article>
          </div>
        </section>
      </aside>
    </div>
  );
}
