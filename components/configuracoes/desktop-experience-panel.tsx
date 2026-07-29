"use client";

import { useEffect } from "react";
import {
  ArchiveIcon,
  BellIcon,
  CheckIcon,
  ClockIcon,
  DatabaseIcon,
  MonitorIcon,
  RefreshIcon,
  SearchIcon,
  ShieldIcon,
  WarningIcon,
} from "@/components/shared/icons";
import { useDesktopExperience } from "@/components/providers/desktop-experience-provider";
import { openDesktopFolder } from "@/lib/desktop/protection";
import { isDesktopDevelopmentRuntime, sendNativeNotification } from "@/lib/desktop/experience";
import type { DesktopExperiencePreferences } from "@/types/desktop-experience";

function formatMilliseconds(value: number | null) {
  return value === null ? "Indisponível" : `${value.toLocaleString("pt-BR")} ms`;
}

function formatBytes(value: number | null) {
  if (value === null) return "Indisponível";
  if (value < 1024) return `${value} B`;
  if (value < 1024 ** 2) return `${(value / 1024).toFixed(1)} KB`;
  if (value < 1024 ** 3) return `${(value / 1024 ** 2).toFixed(1)} MB`;
  return `${(value / 1024 ** 3).toFixed(1)} GB`;
}

export function DesktopExperiencePanel() {
  const developmentBuild = isDesktopDevelopmentRuntime();
  const {
    preferences,
    updatePreferences,
    performance,
    performanceLoading,
    refreshPerformance,
    openCommandPalette,
    createQuickBackup,
    notify,
  } = useDesktopExperience();

  useEffect(() => {
    if (!performance && !performanceLoading) void refreshPerformance();
  }, [performance, performanceLoading, refreshPerformance]);

  async function change<K extends keyof DesktopExperiencePreferences>(key: K, value: DesktopExperiencePreferences[K]) {
    try {
      await updatePreferences({ ...preferences, [key]: value });
      notify({ kind: "success", message: "Preferência desktop atualizada." });
    } catch (caught) {
      notify({ kind: "error", message: caught instanceof Error ? caught.message : String(caught) });
    }
  }

  return (
    <div className="desktop-settings-layout">
      <section className="settings-panel desktop-native-panel">
        <header className="settings-panel-header">
          <div>
            <span className="section-eyebrow">Integração com o Windows</span>
            <h2>Comportamento do aplicativo</h2>
            <p>Defina como a janela, a bandeja, a inicialização e os avisos nativos devem funcionar.</p>
          </div>
          <span className="desktop-feature-badge"><MonitorIcon /> Desktop 0.6</span>
        </header>

        <div className="desktop-setting-list">
          <label className="desktop-setting-row">
            <span className="desktop-setting-icon"><MonitorIcon /></span>
            <span><strong>Fechar para a bandeja</strong><small>O botão fechar oculta a janela e mantém o FinnacialUX protegido em segundo plano.</small></span>
            <input type="checkbox" checked={preferences.closeToTray} onChange={(event) => void change("closeToTray", event.target.checked)} />
          </label>
          <label className="desktop-setting-row">
            <span className="desktop-setting-icon"><ClockIcon /></span>
            <span><strong>Iniciar com o Windows</strong><small>{developmentBuild ? "Disponível depois de instalar a versão de produção." : "Abre o FinnacialUX automaticamente no início da sessão deste usuário."}</small></span>
            <input type="checkbox" disabled={developmentBuild} checked={preferences.startWithWindows} onChange={(event) => void change("startWithWindows", event.target.checked)} />
          </label>
          <label className="desktop-setting-row">
            <span className="desktop-setting-icon"><BellIcon /></span>
            <span><strong>Notificações nativas</strong><small>Mostra confirmações importantes pela Central de Notificações do Windows.</small></span>
            <input type="checkbox" checked={preferences.nativeNotifications} onChange={(event) => void change("nativeNotifications", event.target.checked)} />
          </label>
        </div>

        <div className="desktop-native-actions">
          <button type="button" className="secondary-action-button" onClick={() => void sendNativeNotification("FinnacialUX Desktop", "As notificações nativas estão funcionando neste computador.").then((sent) => {
            notify({ kind: sent ? "success" : "warning", message: sent ? "Notificação de teste enviada." : "O Windows não autorizou notificações para o aplicativo." });
          })}><BellIcon /> Testar notificação</button>
          <button type="button" className="secondary-action-button" onClick={() => openCommandPalette()}><SearchIcon /> Abrir central de comandos</button>
          <button type="button" className="secondary-action-button" onClick={() => void createQuickBackup()}><ArchiveIcon /> Criar backup</button>
        </div>
      </section>

      <section className="settings-panel desktop-performance-panel">
        <header className="settings-panel-header">
          <div>
            <span className="section-eyebrow">Desempenho e integridade</span>
            <h2>Medições deste computador</h2>
            <p>Tempos do WebView, resposta do diagnóstico e estado do banco local.</p>
          </div>
          <button type="button" className="secondary-action-button" disabled={performanceLoading} onClick={() => void refreshPerformance()}><RefreshIcon /> {performanceLoading ? "Medindo..." : "Medir novamente"}</button>
        </header>

        <div className="desktop-performance-grid">
          <article><span><ClockIcon /></span><small>DOM pronto</small><strong>{formatMilliseconds(performance?.domReadyMs ?? null)}</strong><p>Tempo de preparação da interface.</p></article>
          <article><span><MonitorIcon /></span><small>Primeiro conteúdo</small><strong>{formatMilliseconds(performance?.firstContentfulPaintMs ?? null)}</strong><p>Primeiro conteúdo visível no WebView.</p></article>
          <article><span><DatabaseIcon /></span><small>Resposta do diagnóstico</small><strong>{formatMilliseconds(performance?.diagnosticsLatencyMs ?? null)}</strong><p>Consulta nativa com SQLCipher aberto.</p></article>
          <article className={performance?.databaseEncrypted === false ? "warning" : "secure"}><span>{performance?.databaseEncrypted === false ? <WarningIcon /> : <ShieldIcon />}</span><small>Banco local</small><strong>{formatBytes(performance?.databaseSizeBytes ?? null)}</strong><p>{performance?.databaseEncrypted === false ? "Criptografia não confirmada" : `SQLCipher · schema ${performance?.schemaVersion ?? "—"}`}</p></article>
          <article><span><ArchiveIcon /></span><small>Backups registrados</small><strong>{performance?.backupCount ?? "—"}</strong><p>Cópias reconhecidas neste dispositivo.</p></article>
          <article><span><CheckIcon /></span><small>Espaço livre</small><strong>{formatBytes(performance?.availableDiskBytes ?? null)}</strong><p>Disponível na unidade dos dados.</p></article>
        </div>

        <div className="desktop-folder-actions">
          <button type="button" onClick={() => void openDesktopFolder("data")}><DatabaseIcon /><span><strong>Abrir dados locais</strong><small>Banco SQLCipher e arquivos técnicos</small></span></button>
          <button type="button" onClick={() => void openDesktopFolder("backups")}><ArchiveIcon /><span><strong>Abrir backups</strong><small>Cópias manuais e automáticas</small></span></button>
          <button type="button" onClick={() => void openDesktopFolder("logs")}><ClockIcon /><span><strong>Abrir logs</strong><small>Registros sanitizados do aplicativo</small></span></button>
        </div>
      </section>

      <section className="settings-panel desktop-shortcuts-panel">
        <header className="settings-panel-header compact"><div><span className="section-eyebrow">Produtividade</span><h2>Atalhos disponíveis</h2><p>Funcionam em qualquer módulo, respeitando campos de digitação.</p></div></header>
        <div className="desktop-shortcuts-grid">
          {[
            ["Ctrl + K", "Central de comandos"],
            ["Ctrl + N", "Novo lançamento"],
            ["Ctrl + F", "Busca rápida"],
            ["Ctrl + S", "Salvar alterações"],
            ["Ctrl + B", "Criar backup"],
            ["Ctrl + L", "Bloquear aplicativo"],
            ["Ctrl + ,", "Configurações desktop"],
            ["Ctrl + Shift + E", "Exportar dados"],
            ["F1", "Ajuda e atalhos"],
            ["Esc", "Fechar modal ou menu"],
          ].map(([shortcut, action]) => <div key={shortcut}><kbd>{shortcut}</kbd><span>{action}</span></div>)}
        </div>
      </section>
    </div>
  );
}
