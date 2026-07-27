"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { type UnlistenFn } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { DesktopLockScreen } from "@/components/security/desktop-lock-screen";
import { SensitiveActionDialog } from "@/components/security/sensitive-action-dialog";
import { useAuth } from "@/components/providers/auth-provider";
import { closeDesktopDatabase, isDesktopRuntime } from "@/lib/desktop/database";
import {
  changeAccountPassword,
  defaultLocalSecuritySettings,
  disableLocalPin,
  enableLocalPin,
  getLocalSecuritySettings,
  markVaultInitialized,
  recordLocalLock,
  saveLocalSecuritySettings,
  verifyLocalPin,
  verifyUserPassword,
} from "@/lib/desktop/security";
import { ensureDeviceBackupKey, getSecurityVaultStatus, unloadSecurityVault } from "@/lib/desktop/stronghold";
import type { LocalSecuritySettings, SensitiveAction } from "@/types/desktop-security";

type SensitiveRequest = {
  action: SensitiveAction;
  resolve: (allowed: boolean) => void;
};

type DesktopSecurityContextValue = {
  settings: LocalSecuritySettings;
  loading: boolean;
  locked: boolean;
  vaultReady: boolean;
  refreshSettings: () => Promise<LocalSecuritySettings>;
  updateSettings: (settings: LocalSecuritySettings) => Promise<LocalSecuritySettings>;
  enablePin: (password: string, pin: string) => Promise<LocalSecuritySettings>;
  disablePin: (password: string) => Promise<LocalSecuritySettings>;
  updatePassword: (currentPassword: string, newPassword: string) => Promise<void>;
  lock: (reason?: string) => Promise<void>;
  getDeviceBackupKey: () => Promise<string>;
  confirmSensitiveAction: (action: SensitiveAction) => Promise<boolean>;
};

const DesktopSecurityContext = createContext<DesktopSecurityContextValue | null>(null);

export function DesktopSecurityProvider({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const [settings, setSettings] = useState<LocalSecuritySettings>(defaultLocalSecuritySettings);
  const [loading, setLoading] = useState(false);
  const [locked, setLocked] = useState(false);
  const [lockReason, setLockReason] = useState("inatividade");
  const [unlockBusy, setUnlockBusy] = useState(false);
  const [unlockError, setUnlockError] = useState("");
  const [vaultReady, setVaultReady] = useState(false);
  const [sensitiveRequest, setSensitiveRequest] = useState<SensitiveRequest | null>(null);
  const [sensitiveBusy, setSensitiveBusy] = useState(false);
  const [sensitiveError, setSensitiveError] = useState("");
  const inactivityTimer = useRef<number | null>(null);

  const refreshSettings = useCallback(async () => {
    if (!user || !isDesktopRuntime()) return defaultLocalSecuritySettings;
    const stored = await getLocalSecuritySettings(user.id);
    setSettings(stored);
    return stored;
  }, [user]);

  useEffect(() => {
    if (!user || !isDesktopRuntime()) {
      setSettings(defaultLocalSecuritySettings);
      setVaultReady(false);
      setLocked(false);
      return;
    }
    let active = true;
    setLoading(true);
    void Promise.all([getLocalSecuritySettings(user.id), ensureDeviceBackupKey()])
      .then(async ([stored]) => {
        if (!active) return;
        const vault = await getSecurityVaultStatus();
        if (vault.ready && !stored.vaultInitialized) {
          await markVaultInitialized(user.id);
          stored.vaultInitialized = true;
        }
        setSettings(stored);
        setVaultReady(vault.ready && vault.keyAvailable);
      })
      .catch(() => {
        if (active) setVaultReady(false);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [user]);

  const lock = useCallback(async (reason = "inatividade") => {
    if (!user || locked) return;
    setLockReason(reason);
    setUnlockError("");
    setLocked(true);
    try {
      await recordLocalLock(user.id, reason);
      setSettings((current) => ({ ...current, lastLockedAt: new Date().toISOString() }));
    } catch {
      // O bloqueio visual não deve falhar se o evento não puder ser registrado.
    } finally {
      await closeDesktopDatabase().catch(() => undefined);
      await unloadSecurityVault().catch(() => undefined);
      setVaultReady(false);
    }
  }, [locked, user]);

  useEffect(() => {
    if (!user || locked || settings.autoLockMinutes === 0) {
      if (inactivityTimer.current) window.clearTimeout(inactivityTimer.current);
      return;
    }

    const schedule = () => {
      if (inactivityTimer.current) window.clearTimeout(inactivityTimer.current);
      inactivityTimer.current = window.setTimeout(
        () => void lock("inatividade"),
        settings.autoLockMinutes * 60_000,
      );
    };
    const events: Array<keyof WindowEventMap> = ["pointerdown", "keydown", "touchstart", "wheel"];
    let lastPointerReset = 0;
    const handlePointerMove = () => {
      const now = Date.now();
      if (now - lastPointerReset < 15_000) return;
      lastPointerReset = now;
      schedule();
    };
    events.forEach((eventName) => window.addEventListener(eventName, schedule, { passive: true }));
    window.addEventListener("pointermove", handlePointerMove, { passive: true });
    schedule();
    return () => {
      if (inactivityTimer.current) window.clearTimeout(inactivityTimer.current);
      events.forEach((eventName) => window.removeEventListener(eventName, schedule));
      window.removeEventListener("pointermove", handlePointerMove);
    };
  }, [lock, locked, settings.autoLockMinutes, user]);

  useEffect(() => {
    if (!user) return;
    const handleManualLock = () => void lock("solicitação manual");
    window.addEventListener("finnacialux-lock-request", handleManualLock);
    return () => window.removeEventListener("finnacialux-lock-request", handleManualLock);
  }, [lock, user]);

  useEffect(() => {
    if (!user || !settings.lockOnMinimize || !isDesktopRuntime()) return;
    let disposed = false;
    let unlisten: UnlistenFn | undefined;
    const appWindow = getCurrentWindow();

    void appWindow.onResized(async () => {
      if (disposed) return;
      try {
        if (await appWindow.isMinimized()) await lock("janela minimizada");
      } catch {
        // O bloqueio por inatividade continua disponível caso o SO não informe o estado da janela.
      }
    }).then((listener) => {
      if (disposed) listener();
      else unlisten = listener;
    }).catch(() => undefined);

    return () => {
      disposed = true;
      unlisten?.();
    };
  }, [lock, settings.lockOnMinimize, user]);

  async function unlock(credential: string, method: "pin" | "password") {
    if (!user) return;
    setUnlockBusy(true);
    setUnlockError("");
    try {
      if (method === "pin") {
        const result = await verifyLocalPin(user.id, credential);
        setSettings((current) => ({
          ...current,
          failedPinAttempts: result.valid ? 0 : current.failedPinAttempts + 1,
          pinLockedUntil: result.lockedUntil,
        }));
        if (!result.valid) {
          setUnlockError(result.message);
          return;
        }
      } else if (!(await verifyUserPassword(user.id, credential, true))) {
        setUnlockError("A senha não confere.");
        return;
      }
      const vault = await getSecurityVaultStatus();
      setVaultReady(vault.ready && vault.keyAvailable && vault.databaseKeyAvailable);
      setLocked(false);
      setUnlockError("");
    } catch (caught) {
      setUnlockError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setUnlockBusy(false);
    }
  }

  const confirmSensitiveAction = useCallback((action: SensitiveAction) => {
    const required = action === "export"
      ? settings.requirePasswordForExports
      : action === "restore"
        ? settings.requirePasswordForRestore
        : true;
    if (!required || !user) return Promise.resolve(true);
    return new Promise<boolean>((resolve) => {
      setSensitiveError("");
      setSensitiveRequest({ action, resolve });
    });
  }, [settings.requirePasswordForExports, settings.requirePasswordForRestore, user]);

  async function confirmSensitivePassword(password: string) {
    if (!user || !sensitiveRequest) return;
    setSensitiveBusy(true);
    setSensitiveError("");
    try {
      if (!(await verifyUserPassword(user.id, password, true))) {
        setSensitiveError("A senha atual não confere.");
        return;
      }
      const request = sensitiveRequest;
      setSensitiveRequest(null);
      request.resolve(true);
    } catch (caught) {
      setSensitiveError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setSensitiveBusy(false);
    }
  }

  function cancelSensitiveAction() {
    const request = sensitiveRequest;
    setSensitiveRequest(null);
    setSensitiveError("");
    request?.resolve(false);
  }

  const value = useMemo<DesktopSecurityContextValue>(() => ({
    settings,
    loading,
    locked,
    vaultReady,
    refreshSettings,
    updateSettings: async (next) => {
      if (!user) throw new Error("Entre para alterar a segurança local.");
      const stored = await saveLocalSecuritySettings(user.id, next);
      setSettings(stored);
      return stored;
    },
    enablePin: async (password, pin) => {
      if (!user) throw new Error("Entre para configurar o PIN.");
      const stored = await enableLocalPin(user.id, password, pin);
      setSettings(stored);
      return stored;
    },
    disablePin: async (password) => {
      if (!user) throw new Error("Entre para remover o PIN.");
      const stored = await disableLocalPin(user.id, password);
      setSettings(stored);
      return stored;
    },
    updatePassword: async (currentPassword, newPassword) => {
      if (!user) throw new Error("Entre para alterar a senha.");
      await changeAccountPassword(user.id, currentPassword, newPassword);
    },
    lock,
    getDeviceBackupKey: ensureDeviceBackupKey,
    confirmSensitiveAction,
  }), [confirmSensitiveAction, loading, lock, locked, refreshSettings, settings, user, vaultReady]);

  return (
    <DesktopSecurityContext.Provider value={value}>
      {children}
      {locked && user ? (
        <DesktopLockScreen
          userName={user.name}
          pinEnabled={settings.pinEnabled}
          reason={lockReason}
          busy={unlockBusy}
          error={unlockError}
          lockedUntil={settings.pinLockedUntil}
          onUnlock={unlock}
          onLogout={async () => {
            await unloadSecurityVault().catch(() => undefined);
            setLocked(false);
            await logout();
          }}
        />
      ) : null}
      {sensitiveRequest ? (
        <SensitiveActionDialog
          action={sensitiveRequest.action}
          busy={sensitiveBusy}
          error={sensitiveError}
          onConfirm={confirmSensitivePassword}
          onCancel={cancelSensitiveAction}
        />
      ) : null}
    </DesktopSecurityContext.Provider>
  );
}

export function useDesktopSecurity() {
  const context = useContext(DesktopSecurityContext);
  if (!context) throw new Error("useDesktopSecurity deve ser usado dentro de DesktopSecurityProvider.");
  return context;
}
