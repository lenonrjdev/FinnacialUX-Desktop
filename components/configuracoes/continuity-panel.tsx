"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ArchiveIcon,
  CheckIcon,
  DatabaseIcon,
  LockIcon,
  RefreshIcon,
  ShieldIcon,
  WarningIcon,
} from "@/components/shared/icons";
import {
  createRecoveryPoint,
  exitNativeReadOnlyMode,
  getContinuityStatus,
  listRecoveryPoints,
  restoreRecoveryPoint,
  runStartupContinuityCheck,
  saveContinuityPreferences,
  verifyRecoveryPoint,
} from "@/lib/desktop/continuity";
import { ensureDeviceBackupKey } from "@/lib/desktop/stronghold";
import { formatFileSize, formatSettingsDateTime } from "@/lib/settings";
import { canRestoreRecoveryPoint, recoveryPointReasonLabel } from "@/lib/continuity";
import type {
  ContinuityPreferences,
  ContinuityStatus,
  RecoveryPoint,
} from "@/types/desktop-continuity";



export function ContinuityPanel({
  onFeedback,
  onConfirmRestore,
}: {
  onFeedback: (message: string) => void;
  onConfirmRestore: () => Promise<boolean>;
}) {
  const [status, setStatus] = useState<ContinuityStatus | null>(null);
  const [preferences, setPreferences] = useState<ContinuityPreferences | null>(null);
  const [points, setPoints] = useState<RecoveryPoint[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    const [nextStatus, nextPoints] = await Promise.all([
      getContinuityStatus(),
      listRecoveryPoints(),
    ]);
    setStatus(nextStatus);
    setPreferences(nextStatus.preferences);
    setPoints(nextPoints);
  }, []);

  useEffect(() => {
    let active = true;
    void refresh().catch((caught) => {
      if (active) setError(caught instanceof Error ? caught.message : String(caught));
    });
    return () => { active = false; };
  }, [refresh]);

  async function runAction(action: () => Promise<void>) {
    setBusy(true);
    setError("");
    try {
      await action();
      await refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setBusy(false);
    }
  }

  async function savePreferences() {
    if (!preferences) return;
    await runAction(async () => {
      const stored = await saveContinuityPreferences(preferences);
      setPreferences(stored);
      onFeedback("Política de continuidade e retenção atualizada.");
    });
  }

  async function runIntegrityCheck() {
    await runAction(async () => {
      const credential = await ensureDeviceBackupKey().catch(() => undefined);
      const result = await runStartupContinuityCheck(credential);
      onFeedback(result.message);
    });
  }

  async function createPoint() {
    await runAction(async () => {
      const credential = await ensureDeviceBackupKey();
      await createRecoveryPoint(credential, true);
      onFeedback("Ponto de recuperação criptografado criado e verificado.");
    });
  }

  async function verifyPoint(point: RecoveryPoint) {
    await runAction(async () => {
      const credential = point.format === "fuxbackup" ? await ensureDeviceBackupKey().catch(() => undefined) : undefined;
      await verifyRecoveryPoint(point.id, credential);
      onFeedback("Ponto de recuperação verificado com sucesso.");
    });
  }

  async function restorePoint(point: RecoveryPoint) {
    if (!(await onConfirmRestore())) return;
    await runAction(async () => {
      const deviceKey = await ensureDeviceBackupKey();
      await restoreRecoveryPoint(
        point.id,
        point.format === "fuxbackup" ? deviceKey : undefined,
        deviceKey,
      );
      window.location.replace("/login/");
    });
  }

  async function exitReadOnly() {
    await runAction(async () => {
      await exitNativeReadOnlyMode();
      onFeedback("Modo somente leitura encerrado após validação do banco.");
    });
  }

  if (!status || !preferences) {
    return (
      <section className="settings-panel continuity-panel">
        {error ? (
          <div className="continuity-error" role="alert">
            <strong>Não foi possível carregar a continuidade local.</strong>
            <span>{error}</span>
            <button type="button" className="secondary-action-button" onClick={() => void refresh()}>
              <RefreshIcon /> Tentar novamente
            </button>
          </div>
        ) : (
          <p>Carregando a continuidade local...</p>
        )}
      </section>
    );
  }

  return (
    <div className="settings-section-stack continuity-section">
      <section className="settings-panel continuity-overview-panel">
        <header className="settings-panel-header">
          <div>
            <span className="section-eyebrow">Integridade e recuperação</span>
            <h2>Continuidade dos dados</h2>
            <p>Validação nativa, pontos de recuperação SQLCipher e bloqueio de gravações financeiras diante de inconsistências.</p>
          </div>
          <span className="settings-panel-icon"><ShieldIcon /></span>
        </header>

        <div className="continuity-status-grid">
          <article className={status.integrity.ok ? "ok" : "critical"}>
            <span>{status.integrity.ok ? <CheckIcon /> : <WarningIcon />}</span>
            <div><small>Integridade atual</small><strong>{status.integrity.ok ? "Banco íntegro" : "Atenção necessária"}</strong><p>Schema {status.integrity.schemaVersion} · {status.integrity.foreignKeyViolations} violações de relacionamento</p></div>
          </article>
          <article className={status.access.readOnly ? "critical" : "ok"}>
            <span>{status.access.readOnly ? <LockIcon /> : <DatabaseIcon />}</span>
            <div><small>Modo de acesso</small><strong>{status.access.readOnly ? "Somente leitura" : "Leitura e gravação"}</strong><p>{status.access.reason ?? "Gravações liberadas pelo núcleo nativo."}</p></div>
          </article>
          <article>
            <span><ArchiveIcon /></span>
            <div><small>Pontos disponíveis</small><strong>{status.recoveryPointsCount}</strong><p>{status.lastRecoveryPointAt ? `Último em ${formatSettingsDateTime(status.lastRecoveryPointAt)}` : "Nenhum ponto criado"}</p></div>
          </article>
        </div>

        <div className="continuity-actions">
          <button className="secondary-action-button" type="button" disabled={busy} onClick={() => void runIntegrityCheck()}><RefreshIcon /> Verificar agora</button>
          <button className="primary-action-button" type="button" disabled={busy || status.access.readOnly} onClick={() => void createPoint()}><ArchiveIcon /> Criar ponto protegido</button>
          {status.access.readOnly ? <button className="secondary-action-button" type="button" disabled={busy} onClick={() => void exitReadOnly()}><ShieldIcon /> Revalidar e liberar gravações</button> : null}
        </div>
        {status.latestEvent ? <div className={`continuity-latest-event ${status.latestEvent.severity}`}><strong>Último evento</strong><span>{status.latestEvent.message}</span><small>{formatSettingsDateTime(status.latestEvent.createdAt)}</small></div> : null}
        {error ? <div className="continuity-error" role="alert">{error}</div> : null}
      </section>

      <section className="settings-panel continuity-policy-panel">
        <header className="settings-panel-header compact"><div><h2>Política automática</h2><p>Defina quando validar, criar e remover pontos antigos.</p></div></header>
        <div className="settings-form-grid continuity-policy-grid">
          <label className="settings-toggle-row"><span><strong>Verificar ao iniciar</strong><small>Executa PRAGMA integrity_check e foreign_key_check.</small></span><input type="checkbox" checked={preferences.startupIntegrityCheck} onChange={(event) => setPreferences({ ...preferences, startupIntegrityCheck: event.target.checked })} /></label>
          <label className="settings-toggle-row"><span><strong>Ponto diário saudável</strong><small>Cria uma cópia somente depois que a integridade é aprovada.</small></span><input type="checkbox" checked={preferences.createDailyRecoveryPoint} onChange={(event) => setPreferences({ ...preferences, createDailyRecoveryPoint: event.target.checked })} /></label>
          <label className="settings-toggle-row"><span><strong>Somente leitura em falhas</strong><small>Bloqueia comandos financeiros de gravação diretamente no Rust.</small></span><input type="checkbox" checked={preferences.enterReadOnlyOnFailure} onChange={(event) => setPreferences({ ...preferences, enterReadOnlyOnFailure: event.target.checked })} /></label>
          <label className="form-field settings-field"><span>Quantidade mantida</span><select value={preferences.recoveryPointRetention} onChange={(event) => setPreferences({ ...preferences, recoveryPointRetention: Number(event.target.value) })}>{[6, 12, 18, 24, 36, 50].map((value) => <option key={value} value={value}>{value} pontos</option>)}</select></label>
          <label className="form-field settings-field"><span>Idade máxima</span><select value={preferences.maximumAgeDays} onChange={(event) => setPreferences({ ...preferences, maximumAgeDays: Number(event.target.value) })}>{[30, 60, 90, 180, 365].map((value) => <option key={value} value={value}>{value} dias</option>)}</select></label>
        </div>
        <button className="primary-action-button continuity-save-button" type="button" disabled={busy} onClick={() => void savePreferences()}><CheckIcon /> Salvar política</button>
      </section>

      <section className="settings-panel continuity-points-panel">
        <header className="settings-panel-header compact"><div><h2>Pontos de recuperação</h2><p>Cópias validadas, incluindo snapshots protegidos antes de migrations.</p></div><button type="button" className="text-action-button" disabled={busy} onClick={() => void refresh()}>Atualizar</button></header>
        <div className="continuity-points-list">
          {points.length === 0 ? <div className="settings-empty-state"><ArchiveIcon /><strong>Nenhum ponto disponível</strong><span>Crie o primeiro ponto protegido para habilitar a recuperação rápida.</span></div> : points.map((point) => (
            <article key={point.id} className={point.status !== "available" ? "unavailable" : ""}>
              <span className="continuity-point-icon">{point.format === "sqlcipher" ? <DatabaseIcon /> : <ArchiveIcon />}</span>
              <div className="continuity-point-copy">
                <div><strong>{point.fileName}</strong><span>{recoveryPointReasonLabel(point.reason)}</span>{point.protected ? <span className="protected"><LockIcon /> Protegido</span> : null}</div>
                <small>{formatSettingsDateTime(point.createdAt)} · {formatFileSize(point.sizeBytes)} · schema {point.schemaVersion} · {point.format}</small>
              </div>
              <span className={`continuity-point-status ${point.status}`}>{point.status === "available" ? <CheckIcon /> : <WarningIcon />}{point.status === "available" ? "Disponível" : "Indisponível"}</span>
              <div className="continuity-point-actions">
                <button type="button" disabled={busy || point.status !== "available"} onClick={() => void verifyPoint(point)}>Verificar</button>
                <button type="button" disabled={busy || !canRestoreRecoveryPoint(point)} onClick={() => void restorePoint(point)}>Restaurar</button>
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
