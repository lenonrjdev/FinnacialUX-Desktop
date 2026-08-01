"use client";

import { useEffect, useRef } from "react";
import { useAuth } from "@/components/providers/auth-provider";
import { useDesktopExperience } from "@/components/providers/desktop-experience-provider";
import { executeExternalBackupCycle } from "@/lib/external-backup-runtime";
import { getExternalBackupPreferences } from "@/lib/desktop/external-backup";
import { hasTauriRuntime } from "@/lib/desktop/runtime";

export function ExternalBackupProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const { notify } = useDesktopExperience();
  const runningRef = useRef(false);

  useEffect(() => {
    if (!hasTauriRuntime() || !user) return;
    let disposed = false;

    const runCycle = async (mode: "startup" | "focus" | "backup") => {
      if (runningRef.current || disposed) return;
      const preferences = await getExternalBackupPreferences().catch(() => null);
      if (!preferences?.enabled) return;
      if (mode === "startup" && !preferences.mirrorOnStartup) return;
      if (mode === "focus" && !preferences.mirrorOnFocus) return;
      if (mode === "backup" && !preferences.mirrorAfterBackup) return;
      runningRef.current = true;
      try {
        const state = await executeExternalBackupCycle();
        if (state.lastStatus === "verified" && preferences.notifyOnSuccess) {
          notify({ kind: "success", message: "Cópia externa criptografada verificada com sucesso." });
        }
      } catch (error) {
        if (preferences.notifyOnFailure) {
          notify({ kind: "warning", message: error instanceof Error ? error.message : "A cópia externa falhou." });
        }
      } finally {
        runningRef.current = false;
      }
    };

    const handleFocus = () => void runCycle("focus");
    const handleBackup = (event: Event) => {
      const detail = (event as CustomEvent<{ lastStatus?: string }>).detail;
      if (detail?.lastStatus === "created") void runCycle("backup");
    };
    const handleRunNow = () => void runCycle("backup");

    const startupTimer = window.setTimeout(() => void runCycle("startup"), 4_000);
    window.addEventListener("focus", handleFocus);
    window.addEventListener("finnacialux-backup-automation-updated", handleBackup);
    window.addEventListener("finnacialux-external-backup-run-now", handleRunNow);
    return () => {
      disposed = true;
      window.clearTimeout(startupTimer);
      window.removeEventListener("focus", handleFocus);
      window.removeEventListener("finnacialux-backup-automation-updated", handleBackup);
      window.removeEventListener("finnacialux-external-backup-run-now", handleRunNow);
    };
  }, [notify, user]);

  return children;
}
