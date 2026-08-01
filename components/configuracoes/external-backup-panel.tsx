"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ArchiveIcon,
  CheckIcon,
  ClockIcon,
  CopyIcon,
  DatabaseIcon,
  RefreshIcon,
  ShieldIcon,
  TrashIcon,
  UploadIcon,
  WarningIcon,
} from "@/components/shared/icons";
import { createExternalBackupHealth } from "@/lib/external-backup-engine";
import {
  clearExternalBackupHistory,
  loadExternalBackupRuntimeState,
} from "@/lib/external-backup-preferences";
import { executeExternalBackupCycle } from "@/lib/external-backup-runtime";
import {
  chooseExternalBackupDirectory,
  getExternalBackupDestinationStatus,
  getExternalBackupPreferences,
  openExternalBackupDestination,
  saveExternalBackupPreferences,
  verifyExternalBackupDestination,
} from "@/lib/desktop/external-backup";
import { formatFileSize, formatSettingsDateTime } from "@/lib/settings";
import type {
  ExternalBackupDestinationStatus,
  ExternalBackupPreferences,
  ExternalBackupRuntimeState,
  ExternalBackupVerification,
} from "@/types/external-backup";

const emptyStatus: ExternalBackupDestinationStatus = {
  configured: false,
  available: false,
  writable: false,
  independent: false,
  destinationDirectory: null,
  managedDirectory: null,
  destinationKind: "unconfigured",
  reason: "Nenhum destino externo foi configurado.",
  checkedAt: new Date(0).toISOString(),
};

export function ExternalBackupPanel({ onFeedback }: { onFeedback: (message: string) => void }) {
  const [preferences, setPreferences] = useState<ExternalBackupPreferences | null>(null);
  const [destination, setDestination] = useState<ExternalBackupDestinationStatus>(emptyStatus);
  const [verification, setVerification] = useState<ExternalBackupVerification | null>(null);
  const [runtime, setRuntime] = useState<ExternalBackupRuntimeState>(loadExternalBackupRuntimeState());
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [stored, status] = await Promise.all([
        getExternalBackupPreferences(),
        getExternalBackupDestinationStatus(),
      ]);
      setPreferences(stored);
      setDestination(status);
      if (status.available) setVerification(await verifyExternalBackupDestination());
      else setVerification(null);
      setRuntime(loadExternalBackupRuntimeState());
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const update = () => void refresh();
    window.addEventListener("finnacialux-external-backup-updated", update);
    return () => window.removeEventListener("finnacialux-external-backup-updated", update);
  }, [refresh]);

  async function persist(next: ExternalBackupPreferences, message = "Preferências de redundância externa salvas.") {
    setBusy(true);
    setError("");
    try {
      setPreferences(await saveExternalBackupPreferences(next));
      onFeedback(message);
      await refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setBusy(false);
    }
  }

  async function chooseDestination() {
    const selected = await chooseExternalBackupDirectory();
    if (!selected || !preferences) return;
    await persist({ ...preferences, destinationDirectory: selected, enabled: true }, "Destino externo configurado e ativado.");
  }

  async function mirrorNow() {
    setBusy(true);
    setError("");
    try {
      const next = await executeExternalBackupCycle({ force: true });
      setRuntime(next);
      onFeedback(next.lastReason ?? "Cópia externa concluída.");
      await refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
      setRuntime(loadExternalBackupRuntimeState());
    } finally {
      setBusy(false);
    }
  }

  async function verifyNow() {
    setBusy(true);
    setError("");
    try {
      const result = await verifyExternalBackupDestination();
      setVerification(result);
      const next = await executeExternalBackupCycle({ force: true, verifyOnly: true });
      setRuntime(next);
      onFeedback(result.reason);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setBusy(false);
    }
  }

  if (!preferences) {
    return <section className="settings-section external-backup-panel"><div className="settings-empty-state"><ArchiveIcon /><strong>{loading ? "Carregando redundância externa..." : "Não foi possível carregar o destino externo."}</strong></div></section>;
  }

  const health = createExternalBackupHealth({ preferences, destination, verification, runtime });

  return (
    <section className="settings-section external-backup-panel">
      <div className="settings-section-heading">
        <div>
          <span className="section-eyebrow">Redundância real</span>
          <h2>Backup externo criptografado</h2>
          <p>Espelha somente pacotes .fuxbackup já criptografados para outra unidade ou pasta sincronizada. A chave do Stronghold nunca é copiada.</p>
        </div>
        <button className="primary-action-button" type="button" disabled={busy || loading} onClick={() => void mirrorNow()}><UploadIcon /> {busy ? "Processando..." : "Espelhar agora"}</button>
      </div>

      <div className={`external-backup-health ${health.status}`}>
        <div className="backup-automation-score">{health.score}</div>
        <div><strong>{health.title}</strong><p>{health.detail}</p></div>
        {health.status === "protected" ? <ShieldIcon /> : <WarningIcon />}
      </div>

      <div className="external-backup-status-grid">
        <article><DatabaseIcon /><span><small>Destino</small><strong>{destination.destinationKind === "synchronized-folder" ? "Pasta sincronizada" : destination.destinationKind === "secondary-volume" ? "Outro volume" : destination.configured ? "Mesmo volume" : "Não configurado"}</strong><p>{destination.reason}</p></span></article>
        <article><ArchiveIcon /><span><small>Cópias válidas</small><strong>{verification?.validCount ?? 0}</strong><p>{verification?.invalidCount ? `${verification.invalidCount} cópia(s) inválida(s)` : "Checksums SHA-256 conferidos"}</p></span></article>
        <article><ClockIcon /><span><small>Última cópia</small><strong>{health.latestCopyAt ? formatSettingsDateTime(health.latestCopyAt) : "Ainda não criada"}</strong><p>{runtime.lastReason ?? "Aguardando o primeiro espelhamento."}</p></span></article>
        <article><CheckIcon /><span><small>Independência</small><strong>{destination.independent ? "Segunda localização" : "Proteção limitada"}</strong><p>{destination.independent ? "Volume secundário ou pasta sincronizada." : "Prefira mídia externa ou nuvem sincronizada."}</p></span></article>
      </div>

      <div className="external-backup-destination-card">
        <div><span className="section-eyebrow">Local de armazenamento</span><h3>{preferences.destinationDirectory ?? "Nenhuma pasta selecionada"}</h3><p>O FinnacialUX cria uma subpasta exclusiva chamada FinnacialUX-Backups.</p></div>
        <div className="backup-automation-actions">
          <button className="secondary-action-button" type="button" onClick={() => void chooseDestination()}><ArchiveIcon /> Escolher pasta</button>
          <button className="text-action-button" type="button" disabled={!destination.available} onClick={() => void openExternalBackupDestination()}><CopyIcon /> Abrir destino</button>
        </div>
      </div>

      <div className="backup-automation-preferences-grid">
        <article className="updates-preferences-card">
          <div><span className="section-eyebrow">Automação</span><h3>Quando espelhar</h3></div>
          <label className="settings-toggle-row"><span><strong>Ativar redundância externa</strong><small>Exige uma pasta selecionada e grava somente backups criptografados.</small></span><input type="checkbox" checked={preferences.enabled} onChange={(event) => void persist({ ...preferences, enabled: event.target.checked })} /></label>
          <label className="settings-toggle-row"><span><strong>Após backup automático</strong><small>Copia a nova versão assim que o backup local for concluído.</small></span><input type="checkbox" checked={preferences.mirrorAfterBackup} onChange={(event) => void persist({ ...preferences, mirrorAfterBackup: event.target.checked })} /></label>
          <label className="settings-toggle-row"><span><strong>Ao iniciar</strong><small>Reavalia a cópia mais recente sem gerar duplicidades.</small></span><input type="checkbox" checked={preferences.mirrorOnStartup} onChange={(event) => void persist({ ...preferences, mirrorOnStartup: event.target.checked })} /></label>
          <label className="settings-toggle-row"><span><strong>Ao retornar ao aplicativo</strong><small>Detecta quando uma mídia removível volta a ficar disponível.</small></span><input type="checkbox" checked={preferences.mirrorOnFocus} onChange={(event) => void persist({ ...preferences, mirrorOnFocus: event.target.checked })} /></label>
        </article>

        <article className="updates-preferences-card">
          <div><span className="section-eyebrow">Integridade</span><h3>Retenção e avisos</h3></div>
          <label className="form-field settings-field"><span>Cópias externas mantidas</span><select value={preferences.retentionCount} onChange={(event) => void persist({ ...preferences, retentionCount: Number(event.target.value) as ExternalBackupPreferences["retentionCount"] })}><option value={3}>3 cópias</option><option value={5}>5 cópias</option><option value={10}>10 cópias</option><option value={20}>20 cópias</option></select></label>
          <label className="settings-toggle-row"><span><strong>Verificar depois de copiar</strong><small>Compara o arquivo final ao SHA-256 registrado no sidecar.</small></span><input type="checkbox" checked={preferences.verifyAfterCopy} onChange={(event) => void persist({ ...preferences, verifyAfterCopy: event.target.checked })} /></label>
          <label className="settings-toggle-row"><span><strong>Avisar quando concluir</strong><small>Mostra uma confirmação local após a verificação.</small></span><input type="checkbox" checked={preferences.notifyOnSuccess} onChange={(event) => void persist({ ...preferences, notifyOnSuccess: event.target.checked })} /></label>
          <label className="settings-toggle-row"><span><strong>Avisar quando falhar</strong><small>Informa mídia desconectada, permissão negada ou checksum divergente.</small></span><input type="checkbox" checked={preferences.notifyOnFailure} onChange={(event) => void persist({ ...preferences, notifyOnFailure: event.target.checked })} /></label>
        </article>
      </div>

      <div className="backup-automation-actions">
        <button className="secondary-action-button" type="button" disabled={busy || !destination.available} onClick={() => void verifyNow()}><RefreshIcon /> Verificar destino</button>
        <button className="text-action-button" type="button" onClick={() => void refresh()}><DatabaseIcon /> Atualizar estado</button>
        <button className="text-action-button" type="button" onClick={() => { setRuntime(clearExternalBackupHistory()); onFeedback("Histórico técnico externo removido."); }}><TrashIcon /> Limpar histórico</button>
      </div>

      <div className="external-backup-copies">
        <div className="settings-panel-header compact"><div><h3>Cópias externas verificadas</h3><p>Os arquivos permanecem criptografados e possuem sidecar SHA-256 independente.</p></div></div>
        {!verification?.copies.length ? <div className="settings-empty-state"><ArchiveIcon /><strong>Nenhuma cópia externa</strong><span>Conecte o destino e execute o primeiro espelhamento.</span></div> : verification.copies.slice(0, 8).map((copy) => (
          <article className={copy.valid ? "created" : "failed"} key={copy.filePath}><span>{copy.valid ? <CheckIcon /> : <WarningIcon />}</span><div><strong>{copy.fileName}</strong><p>{copy.verificationReason}</p><small>{formatFileSize(copy.sizeBytes)} · {formatSettingsDateTime(copy.createdAt)} · {copy.checksumSha256.slice(0, 12)}…</small></div></article>
        ))}
      </div>

      <div className="backup-automation-history">
        <div className="settings-panel-header compact"><div><h3>Atividade recente</h3><p>Histórico local sanitizado; caminhos completos e conteúdo financeiro não são registrados.</p></div></div>
        {runtime.history.length === 0 ? <div className="settings-empty-state"><ShieldIcon /><strong>Nenhuma atividade registrada</strong></div> : runtime.history.slice(0, 10).map((item) => (
          <article className={item.status === "failed" ? "failed" : item.status === "skipped" ? "skipped" : "created"} key={item.id}><span>{item.status === "failed" ? <WarningIcon /> : <CheckIcon />}</span><div><strong>{item.status === "copied" ? "Cópia criada" : item.status === "verified" ? "Destino verificado" : item.status === "skipped" ? "Cópia já existente" : "Falha no destino"}</strong><p>{item.reason}</p><small>{formatSettingsDateTime(item.checkedAt)}{item.fileName ? ` · ${item.fileName}` : ""}</small></div></article>
        ))}
      </div>

      <div className="external-backup-security-note"><ShieldIcon /><div><strong>A chave criptográfica não sai do dispositivo</strong><p>O destino externo recebe apenas o pacote cifrado e seu checksum. Não são copiados arquivos do Stronghold, senhas ou banco SQLCipher aberto.</p></div></div>
      {error ? <div className="continuity-error" role="alert">{error}</div> : null}
    </section>
  );
}
