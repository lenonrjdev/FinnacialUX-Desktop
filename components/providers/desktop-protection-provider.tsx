"use client";

import { useEffect, useRef } from "react";
import { isDesktopRuntime } from "@/lib/desktop/database";
import { runAutomaticBackup } from "@/lib/desktop/protection";

export function DesktopProtectionProvider({ children }: { children: React.ReactNode }) {
  const checked = useRef(false);

  useEffect(() => {
    if (checked.current || !isDesktopRuntime()) return;
    checked.current = true;
    const timer = window.setTimeout(() => {
      void runAutomaticBackup().catch(() => undefined);
    }, 2200);
    return () => window.clearTimeout(timer);
  }, []);

  return children;
}
