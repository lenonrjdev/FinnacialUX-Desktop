"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useRouter } from "next/navigation";
import { DesktopCommandPalette, type DesktopCommand } from "@/components/desktop/desktop-command-palette";
import { useAuth } from "@/components/providers/auth-provider";
import { useDesktopSecurity } from "@/components/providers/desktop-security-provider";
import { CheckIcon, CloseIcon, WarningIcon } from "@/components/shared/icons";
import {
  applyDesktopExperiencePreferences,
  defaultDesktopExperiencePreferences,
  ensureNativeNotificationPermission,
  getNativeAutostartState,
  loadDesktopExperiencePreferences,
  measureDesktopPerformance,
  saveDesktopExperiencePreferences,
  saveDesktopWindowState,
  sendNativeNotification,
  setNativeAutostartState,
} from "@/lib/desktop/experience";
import { chooseBackupDestination, createManualBackup } from "@/lib/desktop/protection";
import { hasTauriRuntime } from "@/lib/desktop/runtime";
import type {
  DesktopExperienceNotice,
  DesktopExperiencePreferences,
  DesktopPerformanceSnapshot,
} from "@/types/desktop-experience";

type PaletteMode = "commands" | "search";

type DesktopExperienceContextValue = {
  preferences: DesktopExperiencePreferences;
  updatePreferences: (next: DesktopExperiencePreferences) => Promise<DesktopExperiencePreferences>;
  performance: DesktopPerformanceSnapshot | null;
  performanceLoading: boolean;
  refreshPerformance: () => Promise<void>;
  openCommandPalette: (mode?: PaletteMode) => void;
  createQuickBackup: () => Promise<void>;
  notify: (notice: DesktopExperienceNotice) => void;
};

const DesktopExperienceContext = createContext<DesktopExperienceContextValue | null>(null);

function isEditableTarget(target: EventTarget | null) {
  return target instanceof HTMLInputElement
    || target instanceof HTMLTextAreaElement
    || target instanceof HTMLSelectElement
    || (target instanceof HTMLElement && target.isContentEditable);
}

export function DesktopExperienceProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { user } = useAuth();
  const desktopSecurity = useDesktopSecurity();
  const [preferences, setPreferences] = useState(defaultDesktopExperiencePreferences);
  const preferencesRef = useRef(preferences);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [paletteMode, setPaletteMode] = useState<PaletteMode>("commands");
  const [notice, setNotice] = useState<DesktopExperienceNotice | null>(null);
  const [backupBusy, setBackupBusy] = useState(false);
  const [performance, setPerformance] = useState<DesktopPerformanceSnapshot | null>(null);
  const [performanceLoading, setPerformanceLoading] = useState(false);
  const noticeTimer = useRef<number | null>(null);
  const allowCloseRef = useRef(false);

  const notify = useCallback((next: DesktopExperienceNotice) => {
    setNotice(next);
    if (noticeTimer.current) window.clearTimeout(noticeTimer.current);
    noticeTimer.current = window.setTimeout(() => setNotice(null), 5200);
  }, []);

  useEffect(() => {
    const stored = loadDesktopExperiencePreferences();
    setPreferences(stored);
    preferencesRef.current = stored;
    applyDesktopExperiencePreferences(stored);

    if (!hasTauriRuntime()) return;
    void getNativeAutostartState()
      .then((enabled) => {
        if (enabled === stored.startWithWindows) return;
        const synchronized = { ...stored, startWithWindows: enabled };
        setPreferences(synchronized);
        preferencesRef.current = synchronized;
        saveDesktopExperiencePreferences(synchronized);
      })
      .catch(() => undefined);
  }, []);

  const updatePreferences = useCallback(async (next: DesktopExperiencePreferences) => {
    let normalized = next;
    if (hasTauriRuntime() && next.startWithWindows !== preferencesRef.current.startWithWindows) {
      const enabled = await setNativeAutostartState(next.startWithWindows);
      normalized = { ...normalized, startWithWindows: enabled };
    }
    if (hasTauriRuntime() && next.nativeNotifications && !preferencesRef.current.nativeNotifications) {
      const granted = await ensureNativeNotificationPermission();
      if (!granted) normalized = { ...normalized, nativeNotifications: false };
    }
    setPreferences(normalized);
    preferencesRef.current = normalized;
    saveDesktopExperiencePreferences(normalized);
    return normalized;
  }, []);

  const refreshPerformance = useCallback(async () => {
    setPerformanceLoading(true);
    try {
      setPerformance(await measureDesktopPerformance());
    } catch (caught) {
      notify({ kind: "error", message: caught instanceof Error ? caught.message : String(caught) });
    } finally {
      setPerformanceLoading(false);
    }
  }, [notify]);

  const createQuickBackup = useCallback(async () => {
    if (!user || backupBusy) return;
    setBackupBusy(true);
    try {
      const destination = await chooseBackupDestination();
      if (!destination) return;
      const credential = await desktopSecurity.getDeviceBackupKey();
      await createManualBackup(destination, "device", credential);
      notify({ kind: "success", message: "Backup criptografado criado e verificado com sucesso." });
      if (preferencesRef.current.nativeNotifications) {
        await sendNativeNotification("Backup concluído", "A cópia criptografada do FinnacialUX foi criada com sucesso.").catch(() => false);
      }
    } catch (caught) {
      notify({ kind: "error", message: caught instanceof Error ? caught.message : String(caught) });
    } finally {
      setBackupBusy(false);
    }
  }, [backupBusy, desktopSecurity, notify, user]);

  const openCommandPalette = useCallback((mode: PaletteMode = "commands") => {
    setPaletteMode(mode);
    setPaletteOpen(true);
  }, []);

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      const control = event.ctrlKey || event.metaKey;
      const editable = isEditableTarget(event.target);

      if (control && event.key.toLocaleLowerCase("pt-BR") === "k") {
        event.preventDefault();
        openCommandPalette("commands");
      } else if (control && event.key.toLocaleLowerCase("pt-BR") === "f" && !editable) {
        event.preventDefault();
        openCommandPalette("search");
      } else if (control && event.key.toLocaleLowerCase("pt-BR") === "n" && !editable) {
        event.preventDefault();
        router.push("/lancamentos#novo-lancamento");
      } else if (control && event.key.toLocaleLowerCase("pt-BR") === "b" && !editable) {
        event.preventDefault();
        void createQuickBackup();
      } else if (control && event.key.toLocaleLowerCase("pt-BR") === "l" && !editable) {
        event.preventDefault();
        void desktopSecurity.lock("atalho de teclado");
      } else if (control && event.key === ",") {
        event.preventDefault();
        router.push("/configuracoes#desktop");
      } else if (control && event.shiftKey && event.key.toLocaleLowerCase("pt-BR") === "e") {
        event.preventDefault();
        router.push("/dados-e-automacoes#exportar");
      } else if (control && event.key.toLocaleLowerCase("pt-BR") === "s") {
        const saveButton = document.querySelector<HTMLButtonElement>("[data-desktop-save]");
        if (saveButton && !saveButton.disabled) {
          event.preventDefault();
          saveButton.click();
        }
        window.dispatchEvent(new CustomEvent("finnacialux-save-request"));
      } else if (event.key === "F1") {
        event.preventDefault();
        router.push("/ajuda");
      }
    };
    window.addEventListener("keydown", handleShortcut, true);
    return () => window.removeEventListener("keydown", handleShortcut, true);
  }, [createQuickBackup, desktopSecurity, openCommandPalette, router]);

  useEffect(() => {
    if (!hasTauriRuntime()) return;
    const unlisteners: UnlistenFn[] = [];
    let disposed = false;

    void listen("finnacialux-lock-requested-native", () => void desktopSecurity.lock("bandeja do sistema"))
      .then((unlisten) => disposed ? unlisten() : unlisteners.push(unlisten))
      .catch(() => undefined);
    void listen("finnacialux-backup-requested-native", () => void createQuickBackup())
      .then((unlisten) => disposed ? unlisten() : unlisteners.push(unlisten))
      .catch(() => undefined);

    const handleForceExit = () => {
      allowCloseRef.current = true;
    };
    const handleUpdateInstallFailed = () => {
      allowCloseRef.current = false;
    };
    window.addEventListener("finnacialux-force-exit", handleForceExit);
    window.addEventListener("finnacialux-update-install-failed", handleUpdateInstallFailed);

    const appWindow = getCurrentWindow();
    void appWindow.onCloseRequested(async (event) => {
      if (allowCloseRef.current || !preferencesRef.current.closeToTray) return;
      event.preventDefault();
      await saveDesktopWindowState().catch(() => undefined);
      if (desktopSecurity.settings.lockOnMinimize) {
        await desktopSecurity.lock("janela fechada para a bandeja");
      }
      await appWindow.hide().catch(() => undefined);
      if (preferencesRef.current.nativeNotifications) {
        await sendNativeNotification("FinnacialUX continua protegido", "O aplicativo foi minimizado para a bandeja do Windows.").catch(() => false);
      }
    }).then((unlisten) => disposed ? unlisten() : unlisteners.push(unlisten)).catch(() => undefined);

    return () => {
      disposed = true;
      window.removeEventListener("finnacialux-force-exit", handleForceExit);
      window.removeEventListener("finnacialux-update-install-failed", handleUpdateInstallFailed);
      unlisteners.forEach((unlisten) => unlisten());
    };
  }, [createQuickBackup, desktopSecurity]);

  const commands = useMemo<DesktopCommand[]>(() => [
    {
      id: "search",
      label: "Buscar no FinnacialUX",
      description: "Localize páginas e ações pela central de comandos.",
      keywords: ["buscar", "pesquisar", "localizar"],
      shortcut: "Ctrl F",
      icon: "search",
      run: () => openCommandPalette("search"),
    },
    {
      id: "new-transaction",
      label: "Novo lançamento",
      description: "Registre uma nova entrada ou saída.",
      keywords: ["receita", "despesa", "transação", "lançamento"],
      shortcut: "Ctrl N",
      icon: "transaction",
      run: () => router.push("/lancamentos#novo-lancamento"),
    },
    {
      id: "backup",
      label: backupBusy ? "Criando backup..." : "Criar backup agora",
      description: "Gere uma cópia criptografada em um local escolhido.",
      keywords: ["backup", "cópia", "segurança"],
      shortcut: "Ctrl B",
      icon: "backup",
      run: createQuickBackup,
    },
    {
      id: "lock",
      label: "Bloquear FinnacialUX",
      description: "Proteja imediatamente o banco e a interface.",
      keywords: ["bloquear", "pin", "segurança"],
      shortcut: "Ctrl L",
      icon: "lock",
      run: () => desktopSecurity.lock("central de comandos"),
    },
    {
      id: "settings",
      label: "Abrir configurações desktop",
      description: "Janela, inicialização, notificações e desempenho.",
      keywords: ["configurações", "desktop", "windows"],
      shortcut: "Ctrl ,",
      icon: "settings",
      run: () => router.push("/configuracoes#desktop"),
    },
    {
      id: "accessibility",
      label: "Acessibilidade",
      description: "Contraste, movimento, texto e foco do teclado.",
      keywords: ["acessibilidade", "contraste", "fonte", "movimento"],
      icon: "settings",
      run: () => router.push("/configuracoes#acessibilidade"),
    },
    {
      id: "diagnostics",
      label: "Diagnóstico do aplicativo",
      description: "Integridade, SQLCipher, armazenamento e logs.",
      keywords: ["diagnóstico", "banco", "sqlcipher", "logs"],
      icon: "database",
      run: () => router.push("/configuracoes#diagnostico"),
    },
    {
      id: "export",
      label: "Exportar dados",
      description: "Abra a área de dados e portabilidade.",
      keywords: ["exportar", "dados", "json", "csv"],
      shortcut: "Ctrl Shift E",
      icon: "data",
      run: () => router.push("/dados-e-automacoes#exportar"),
    },
    {
      id: "help",
      label: "Ajuda e atalhos",
      description: "Primeiros passos, segurança e suporte interno.",
      keywords: ["ajuda", "atalhos", "suporte", "manual"],
      shortcut: "F1",
      icon: "help",
      run: () => router.push("/ajuda"),
    },
  ], [backupBusy, createQuickBackup, desktopSecurity, openCommandPalette, router]);

  const value = useMemo<DesktopExperienceContextValue>(() => ({
    preferences,
    updatePreferences,
    performance,
    performanceLoading,
    refreshPerformance,
    openCommandPalette,
    createQuickBackup,
    notify,
  }), [createQuickBackup, notify, openCommandPalette, performance, performanceLoading, preferences, refreshPerformance, updatePreferences]);

  return (
    <DesktopExperienceContext.Provider value={value}>
      <a className="desktop-skip-link" href="#conteudo-principal">Pular para o conteúdo principal</a>
      {children}
      <DesktopCommandPalette
        open={paletteOpen}
        mode={paletteMode}
        commands={commands}
        onClose={() => setPaletteOpen(false)}
      />
      {notice ? (
        <aside className={`desktop-experience-toast ${notice.kind}`} role={notice.kind === "error" ? "alert" : "status"}>
          <span>{notice.kind === "error" || notice.kind === "warning" ? <WarningIcon /> : <CheckIcon />}</span>
          <p>{notice.message}</p>
          <button type="button" onClick={() => setNotice(null)} aria-label="Fechar mensagem"><CloseIcon /></button>
        </aside>
      ) : null}
    </DesktopExperienceContext.Provider>
  );
}

export function useDesktopExperience() {
  const value = useContext(DesktopExperienceContext);
  if (!value) throw new Error("useDesktopExperience precisa estar dentro do DesktopExperienceProvider.");
  return value;
}
