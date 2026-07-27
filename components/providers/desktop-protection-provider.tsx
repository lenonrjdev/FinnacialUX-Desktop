"use client";

import { useEffect, useRef } from "react";
import { isDesktopRuntime } from "@/lib/desktop/database";
import { useAuth } from "@/components/providers/auth-provider";
import { useDesktopSecurity } from "@/components/providers/desktop-security-provider";
import { runAutomaticBackup } from "@/lib/desktop/protection";

export function DesktopProtectionProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const { vaultReady, getDeviceBackupKey } = useDesktopSecurity();
  const checked = useRef(false);

  useEffect(() => {
    if (checked.current || !isDesktopRuntime() || !user || !vaultReady) return;
    checked.current = true;
    const timer = window.setTimeout(() => {
      void getDeviceBackupKey()
        .then((key) => runAutomaticBackup(key))
        .catch(() => undefined);
    }, 2200);
    return () => window.clearTimeout(timer);
  }, [getDeviceBackupKey, user, vaultReady]);

  return children;
}
