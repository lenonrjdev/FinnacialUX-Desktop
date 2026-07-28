"use client";

import { useEffect, useMemo, useState } from "react";
import type { Update } from "@tauri-apps/plugin-updater";
import { ArchiveIcon, CheckIcon, RefreshIcon, ShieldIcon, WarningIcon } from "@/components/shared/icons";
import {
  checkDesktopUpdate,
  getDesktopUpdaterStatus,
  installDesktopUpdate,
  loadDesktopUpdaterPreferences,
  saveDesktopUpdaterPreferences,
  skipDesktopUpdate,
} from "@/lib/desktop/updater";
import type {
  DesktopUpdateProgress,
  DesktopUpdaterPreferences,
  DesktopUpdaterStatus,
} from "@/types/desktop-updater";

const idleProgress: DesktopUpdateProgress = {
  phase: "idle",
  downloadedBytes: 0,
  totalBytes: null,
  percent: 0,
  message: "",
};

function formatDate(value: string | null) {
  if (!value) return "Ainda não verificado";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Data indisponível";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

export function UpdatesPanel({
  onConfirmInstall,
  getBackupCredential,
  onFeedback,
}: {
  onConfirmInstall: () => Promise<boolean>;
  getBackupCredential: () => Promise<string>;
  onFeedback: (message: string) => void;
}) {
  const [status, setStatus] = useState<DesktopUpdaterStatus | null>(null);
  const [preferences, setPreferences] = useState<DesktopUpdaterPreferences>(loadDesktopUpdaterPreferences());
  const [availableUpdate, setAvailableUpdate] = useState<Update | null>(null);
  const [checking, setChecking] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [progress, setProgress] = useState<DesktopUpdateProgress>(idleProgress);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let active = true;
    void getDesktopUpdaterStatus()
      .then((value) => {
        if (!active) return;
        setStatus(value);
        setPreferences(value.preferences);
      })
      .catch((caught) => active && setMessage(caught instanceof Error ? caught.message : String(caught)));
    return () => { active = false; };
  }, []);

  useEffect(() => () => {
    void availableUpdate?.close().catch(() => undefined);
  }, [availableUpdate]);

  const percentLabel = useMemo(() => progress.totalBytes ? `${progress.percent}%` : "Em andamento", [progress]);

  function persistPreferences(next: DesktopUpdaterPreferences) {
    setPreferences(saveDesktopUpdaterPreferences(next));
    onFeedback("Preferências de atualização salvas neste computador.");
  }

  async function runCheck() {
    setChecking(true);
    setMessage("");
    try {
      await availableUpdate?.close().catch(() => undefined);
      const result = await checkDesktopUpdate(true);
      setAvailableUpdate(result.update);
      setPreferences(loadDesktopUpdaterPreferences());
      setStatus(await getDesktopUpdaterStatus());
      setMessage(result.reason);
    } catch (caught) {
      setAvailableUpdate(null);
      setMessage(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setChecking(false);
    }
  }

  async function install() {
    if (!availableUpdate || !(await onConfirmInstall())) return;
    setInstalling(true);
    setMessage("");
    try {
      const credential = preferences.backupBeforeInstall ? await getBackupCredential() : null;
      await installDesktopUpdate(availableUpdate, preferences, credential, setProgress);
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : String(caught));
      setInstalling(false);
    }
  }

  async function skipVersion() {
    if (!availableUpdate) return;
    skipDesktopUpdate(availableUpdate.version);
    await availableUpdate.close().catch(() => undefined);
    setAvailableUpdate(null);
    setPreferences(loadDesktopUpdaterPreferences());
    setMessage("Esta versão foi ignorada. Uma versão posterior continuará sendo apresentada.");
  }

  if (!status) {
    return <section className="settings-section updates-panel"><div className="updates-loading"><RefreshIcon /> Preparando atualizações...</div></section>;
  }

  return (
    <section className="settings-section updates-panel">
      <div className="settings-section-heading">
        <div>
          <span className="section-eyebrow">Distribuição segura</span>
          <h2>Atualizações do FinnacialUX</h2>
          <p>Verifique novas versões, leia as mudanças e instale somente pacotes assinados.</p>
        </div>
        <button className="secondary-action-button" type="button" disabled={checking || installing || !status.configured} onClick={() => void runCheck()}>
          <RefreshIcon /> {checking ? "Verificando..." : "Verificar agora"}
        </button>
      </div>

      <div className="updates-status-grid">
        <article className={status.configured ? "healthy" : "attention"}>
          <ShieldIcon />
          <div><strong>Canal de atualização</strong><small>{status.configured ? `Estável · ${status.endpointHost}` : "Ainda não configurado para distribuição"}</small></div>
        </article>
        <article className="healthy">
          <CheckIcon />
          <div><strong>Versão instalada</strong><small>{status.currentVersion}</small></div>
        </article>
        <article className={preferences.backupBeforeInstall ? "healthy" : "attention"}>
          <ArchiveIcon />
          <div><strong>Backup pré-atualização</strong><small>{preferences.backupBeforeInstall ? "Ativado e criptografado pelo dispositivo" : "Desativado"}</small></div>
        </article>
      </div>

      {!status.configured ? (
        <div className="updates-setup-notice">
          <WarningIcon />
          <div>
            <strong>Configure a assinatura antes de publicar</strong>
            <p>Execute <code>.\\04_CONFIGURAR_ATUALIZACOES.cmd</code> na raiz do projeto. A chave privada ficará fora do código e somente a chave pública será incorporada ao aplicativo.</p>
          </div>
        </div>
      ) : null}

      {status.developmentBuild ? (
        <div className="updates-dev-notice">
          <WarningIcon />
          <div><strong>Modo de desenvolvimento</strong><p>A interface pode ser configurada aqui, mas a verificação real acontece somente no aplicativo instalado pelo setup da release.</p></div>
        </div>
      ) : null}

      <div className="updates-preferences-card">
        <div><span className="section-eyebrow">Preferências locais</span><h3>Como procurar novas versões</h3></div>
        <label className="settings-toggle-row">
          <span><strong>Verificação automática</strong><small>Procura uma nova versão depois do login, respeitando o intervalo escolhido.</small></span>
          <input type="checkbox" checked={preferences.automaticCheck} onChange={(event) => persistPreferences({ ...preferences, automaticCheck: event.target.checked })} />
        </label>
        <label className="form-field settings-field">
          <span>Intervalo de verificação</span>
          <select value={preferences.checkIntervalHours} onChange={(event) => persistPreferences({ ...preferences, checkIntervalHours: Number(event.target.value) as DesktopUpdaterPreferences["checkIntervalHours"] })}>
            <option value={6}>A cada 6 horas</option><option value={12}>A cada 12 horas</option><option value={24}>Uma vez por dia</option><option value={48}>A cada 2 dias</option><option value={72}>A cada 3 dias</option>
          </select>
        </label>
        <label className="settings-toggle-row">
          <span><strong>Criar backup antes de instalar</strong><small>Gera uma cópia criptografada do banco SQLCipher antes de iniciar o instalador.</small></span>
          <input type="checkbox" checked={preferences.backupBeforeInstall} onChange={(event) => persistPreferences({ ...preferences, backupBeforeInstall: event.target.checked })} />
        </label>
        <small className="updates-last-check">Última verificação: {formatDate(preferences.lastCheckedAt)}</small>
      </div>

      {availableUpdate ? (
        <article className="update-available-card">
          <div className="update-version-row"><span>Nova versão</span><strong>{availableUpdate.currentVersion} → {availableUpdate.version}</strong></div>
          <div className="update-release-notes"><strong>Notas da versão</strong><p>{availableUpdate.body?.trim() || "Esta versão não possui notas adicionais."}</p></div>
          {progress.phase !== "idle" ? (
            <div className="update-progress" aria-live="polite">
              <div><span>{progress.message}</span><strong>{percentLabel}</strong></div>
              <div className="update-progress-track"><span style={{ width: `${progress.totalBytes ? progress.percent : 12}%` }} /></div>
            </div>
          ) : null}
          <div className="update-actions">
            <button className="primary-action-button" type="button" disabled={installing} onClick={() => void install()}><RefreshIcon /> {installing ? "Preparando instalação..." : "Baixar e instalar"}</button>
            <button className="text-action-button" type="button" disabled={installing} onClick={() => void skipVersion()}>Ignorar esta versão</button>
          </div>
        </article>
      ) : null}

      {message ? <div className="updates-message" role="status">{message}</div> : null}
    </section>
  );
}
