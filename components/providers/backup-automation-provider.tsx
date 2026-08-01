"use client";

import { useEffect, useRef } from "react";
import { useAuth } from "@/components/providers/auth-provider";
import { useDesktopExperience } from "@/components/providers/desktop-experience-provider";
import { useDesktopSecurity } from "@/components/providers/desktop-security-provider";
import { executeBackupAutomationCycle } from "@/lib/backup-automation-runtime";
import { loadBackupAutomationPreferences } from "@/lib/backup-automation-preferences";
import { hasTauriRuntime } from "@/lib/desktop/runtime";

const MINUTE_MS = 60_000;

export function BackupAutomationProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const { vaultReady, getDeviceBackupKey } = useDesktopSecurity();
  const { notify } = useDesktopExperience();
  const timerRef = useRef<number | null>(null);
  const runningRef = useRef(false);

  useEffect(() => {
    if (!hasTauriRuntime() || !user || !vaultReady) return;
    let disposed = false;

    const clearTimer = () => {
      if (timerRef.current !== null) window.clearInterval(timerRef.current);
      timerRef.current = null;
    };

    const runCycle = async () => {
      if (runningRef.current || disposed) return;
      runningRef.current = true;
      try {
        const state = await executeBackupAutomationCycle(getDeviceBackupKey);
        const preferences = loadBackupAutomationPreferences();
        if (state.lastStatus === "created" && preferences.notifyOnSuccess) {
          notify({ kind: "success", message: "Backup automático criptografado concluído." });
        }
      } catch (error) {
        if (loadBackupAutomationPreferences().notifyOnFailure) {
          notify({
            kind: "warning",
            message: error instanceof Error ? error.message : "O backup automático falhou.",
          });
        }
      } finally {
        runningRef.current = false;
      }
    };

    const configure = (runStartup: boolean) => {
      const preferences = loadBackupAutomationPreferences();
      clearTimer();
      timerRef.current = window.setInterval(
        () => void runCycle(),
        preferences.checkIntervalMinutes * MINUTE_MS,
      );
      if (runStartup && preferences.runOnStartup) void runCycle();
    };

    const handleFocus = () => {
      if (loadBackupAutomationPreferences().runOnFocus) void runCycle();
    };
    const handlePreferences = () => configure(false);
    const handleRunNow = () => void runCycle();

    configure(true);
    window.addEventListener("focus", handleFocus);
    window.addEventListener("finnacialux-backup-automation-preferences-updated", handlePreferences);
    window.addEventListener("finnacialux-backup-automation-run-now", handleRunNow);

    return () => {
      disposed = true;
      clearTimer();
      window.removeEventListener("focus", handleFocus);
      window.removeEventListener("finnacialux-backup-automation-preferences-updated", handlePreferences);
      window.removeEventListener("finnacialux-backup-automation-run-now", handleRunNow);
    };
  }, [getDeviceBackupKey, notify, user, vaultReady]);

  return children;
}
