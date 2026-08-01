"use client";

import { useEffect, useRef } from "react";
import { useAuth } from "@/components/providers/auth-provider";
import { useDesktopExperience } from "@/components/providers/desktop-experience-provider";
import { useDesktopSecurity } from "@/components/providers/desktop-security-provider";
import { executeRecoveryReadinessDrill } from "@/lib/recovery-readiness-runtime";
import { loadRecoveryReadinessPreferences } from "@/lib/recovery-readiness-preferences";
import { hasTauriRuntime } from "@/lib/desktop/runtime";

const CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000;

export function RecoveryReadinessProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const { vaultReady, getDeviceBackupKey } = useDesktopSecurity();
  const { notify } = useDesktopExperience();
  const timerRef = useRef<number | null>(null);
  const startupTimerRef = useRef<number | null>(null);
  const runningRef = useRef(false);

  useEffect(() => {
    if (!hasTauriRuntime() || !user || !vaultReady) return;
    let disposed = false;

    const run = async (force = false) => {
      if (disposed || runningRef.current) return;
      runningRef.current = true;
      try {
        const previous = loadRecoveryReadinessPreferences();
        const state = await executeRecoveryReadinessDrill(getDeviceBackupKey, { force });
        if (state.lastStatus === "passed" && previous.notifyOnSuccess) {
          notify({ kind: "success", message: "Ensaio de recuperação concluído sem alterar seus dados." });
        }
      } catch (error) {
        if (loadRecoveryReadinessPreferences().notifyOnFailure) {
          notify({ kind: "warning", message: error instanceof Error ? error.message : "O ensaio de recuperação falhou." });
        }
      } finally {
        runningRef.current = false;
      }
    };

    const preferences = loadRecoveryReadinessPreferences();
    if (preferences.runOnStartup) {
      startupTimerRef.current = window.setTimeout(() => void run(false), 15_000);
    }
    timerRef.current = window.setInterval(() => void run(false), CHECK_INTERVAL_MS);
    const handleFocus = () => {
      if (loadRecoveryReadinessPreferences().runOnFocus) void run(false);
    };
    const handleRunNow = () => void run(true);
    const handleBackupUpdated = () => void run(false);
    window.addEventListener("focus", handleFocus);
    window.addEventListener("finnacialux-recovery-readiness-run-now", handleRunNow);
    window.addEventListener("finnacialux-backup-automation-updated", handleBackupUpdated);

    return () => {
      disposed = true;
      if (timerRef.current !== null) window.clearInterval(timerRef.current);
      if (startupTimerRef.current !== null) window.clearTimeout(startupTimerRef.current);
      window.removeEventListener("focus", handleFocus);
      window.removeEventListener("finnacialux-recovery-readiness-run-now", handleRunNow);
      window.removeEventListener("finnacialux-backup-automation-updated", handleBackupUpdated);
    };
  }, [getDeviceBackupKey, notify, user, vaultReady]);

  return children;
}
