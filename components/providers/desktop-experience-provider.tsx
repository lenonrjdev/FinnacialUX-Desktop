"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { usePathname, useRouter } from "next/navigation";
import { DesktopCommandPalette, type DesktopCommand } from "@/components/desktop/desktop-command-palette";
import { ContextualHelpPanel } from "@/components/ajuda/contextual-help-panel";
import { useAuth } from "@/components/providers/auth-provider";
import { useDesktopSecurity } from "@/components/providers/desktop-security-provider";
import { CheckIcon, CloseIcon, WarningIcon } from "@/components/shared/icons";
import { contextualHelpTopics } from "@/content/onboarding";
import { dashboardNavigation } from "@/content/dashboard";
import { findContextualHelp } from "@/lib/onboarding-engine";
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
  openContextHelp: () => void;
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
  const pathname = usePathname();
  const { user } = useAuth();
  const desktopSecurity = useDesktopSecurity();
  const [preferences, setPreferences] = useState(defaultDesktopExperiencePreferences);
  const preferencesRef = useRef(preferences);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [paletteMode, setPaletteMode] = useState<PaletteMode>("commands");
  const [contextHelpOpen, setContextHelpOpen] = useState(false);
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

  const openContextHelp = useCallback(() => {
    const enabled = typeof window === "undefined"
      || window.localStorage.getItem("finnacialux-contextual-help-enabled") !== "false";
    if (!enabled) {
      notify({ kind: "info", message: "A ajuda contextual está desativada. Reative em Configurações → Primeiros passos." });
      return;
    }
    setContextHelpOpen(true);
  }, [notify]);

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
        if (event.shiftKey) router.push("/ajuda");
        else openContextHelp();
      }
    };
    window.addEventListener("keydown", handleShortcut, true);
    return () => window.removeEventListener("keydown", handleShortcut, true);
  }, [createQuickBackup, desktopSecurity, openCommandPalette, openContextHelp, router]);

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

  const commands = useMemo<DesktopCommand[]>(() => {
    const navigationCommands: DesktopCommand[] = dashboardNavigation
      .flatMap((group) => group.items.map((item) => ({
        id: `navigate:${item.href}`,
        label: item.label,
        description: `Abrir ${item.label.toLocaleLowerCase("pt-BR")} no FinnacialUX.`,
        keywords: [group.label, item.label, item.href.replaceAll("/", " ").replaceAll("-", " ")],
        category: "Navegação" as const,
        icon: item.href === "/ajuda" ? "help" as const : item.href === "/configuracoes" ? "settings" as const : "search" as const,
        run: () => router.push(item.href),
      })));
    const helpCommands: DesktopCommand[] = contextualHelpTopics.map((topic) => ({
      id: `help:${topic.id}`,
      label: topic.title,
      description: topic.summary,
      keywords: [...topic.steps, ...topic.related.map((item) => item.label)],
      category: "Ajuda" as const,
      icon: "help" as const,
      run: () => {
        router.push(topic.path);
        window.setTimeout(openContextHelp, 80);
      },
    }));
    return [
      {
        id: "search",
        label: "Buscar no FinnacialUX",
        description: "Localize páginas, ações, configurações e ajuda.",
        keywords: ["buscar", "pesquisar", "localizar", "global"],
        shortcut: "Ctrl F",
        category: "Ações",
        icon: "search",
        run: () => openCommandPalette("search"),
      },
      {
        id: "onboarding",
        label: "Continuar primeiros passos",
        description: "Retome o guia de configuração do espaço financeiro.",
        keywords: ["onboarding", "começar", "guia", "configuração"],
        category: "Ajuda",
        icon: "help",
        run: () => {
          window.dispatchEvent(new CustomEvent("finnacialux-onboarding-open-request"));
        },
      },
      {
        id: "context-help",
        label: "Ajuda desta tela",
        description: "Veja orientações relacionadas à página atual.",
        keywords: ["contexto", "como usar", "manual", "f1"],
        shortcut: "F1",
        category: "Ajuda",
        icon: "help",
        run: openContextHelp,
      },
      {
        id: "new-transaction",
        label: "Novo lançamento",
        description: "Registre uma nova entrada ou saída.",
        keywords: ["receita", "despesa", "transação", "lançamento"],
        shortcut: "Ctrl N",
        category: "Ações",
        icon: "transaction",
        run: () => router.push("/lancamentos#novo-lancamento"),
      },
      {
        id: "backup",
        label: backupBusy ? "Criando backup..." : "Criar backup agora",
        description: "Gere uma cópia criptografada em um local escolhido.",
        keywords: ["backup", "cópia", "segurança"],
        shortcut: "Ctrl B",
        category: "Ações",
        icon: "backup",
        run: createQuickBackup,
      },
      {
        id: "lock",
        label: "Bloquear FinnacialUX",
        description: "Proteja imediatamente o banco e a interface.",
        keywords: ["bloquear", "pin", "segurança"],
        shortcut: "Ctrl L",
        category: "Ações",
        icon: "lock",
        run: () => desktopSecurity.lock("central de comandos"),
      },
      {
        id: "settings",
        label: "Abrir configurações desktop",
        description: "Janela, inicialização, notificações e desempenho.",
        keywords: ["configurações", "desktop", "windows"],
        shortcut: "Ctrl ,",
        category: "Configurações",
        icon: "settings",
        run: () => router.push("/configuracoes#desktop"),
      },
      {
        id: "background-tasks",
        label: "Rotinas locais",
        description: "Fila, notificações, tentativas e execução em segundo plano.",
        keywords: ["rotinas", "agendador", "notificações", "fila"],
        category: "Configurações",
        icon: "settings",
        run: () => router.push("/configuracoes#rotinas"),
      },
      {
        id: "accessibility",
        label: "Acessibilidade",
        description: "Contraste, movimento, texto e foco do teclado.",
        keywords: ["acessibilidade", "contraste", "fonte", "movimento"],
        category: "Configurações",
        icon: "settings",
        run: () => router.push("/configuracoes#acessibilidade"),
      },
      {
        id: "diagnostics",
        label: "Diagnóstico do aplicativo",
        description: "Integridade, SQLCipher, armazenamento e logs.",
        keywords: ["diagnóstico", "banco", "sqlcipher", "logs"],
        category: "Configurações",
        icon: "database",
        run: () => router.push("/configuracoes#diagnostico"),
      },
      {
        id: "export",
        label: "Exportar dados",
        description: "Abra a área de dados e portabilidade.",
        keywords: ["exportar", "dados", "json", "csv"],
        shortcut: "Ctrl Shift E",
        category: "Ações",
        icon: "data",
        run: () => router.push("/dados-e-automacoes#exportar"),
      },
      {
        id: "help",
        label: "Central completa de ajuda",
        description: "Primeiros passos, segurança, atalhos e suporte interno.",
        keywords: ["ajuda", "atalhos", "suporte", "manual"],
        shortcut: "Shift F1",
        category: "Ajuda",
        icon: "help",
        run: () => router.push("/ajuda"),
      },
      ...navigationCommands,
      ...helpCommands,
    ];
  }, [backupBusy, createQuickBackup, desktopSecurity, openCommandPalette, openContextHelp, router]);

  const value = useMemo<DesktopExperienceContextValue>(() => ({
    preferences,
    updatePreferences,
    performance,
    performanceLoading,
    refreshPerformance,
    openCommandPalette,
    openContextHelp,
    createQuickBackup,
    notify,
  }), [createQuickBackup, notify, openCommandPalette, openContextHelp, performance, performanceLoading, preferences, refreshPerformance, updatePreferences]);

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
      <ContextualHelpPanel
        open={contextHelpOpen}
        topic={findContextualHelp(pathname || "/visao-geral")}
        onClose={() => setContextHelpOpen(false)}
        onOpenSearch={() => openCommandPalette("search")}
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
