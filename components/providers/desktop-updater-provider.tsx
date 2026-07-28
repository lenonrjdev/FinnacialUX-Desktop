"use client";

import { useEffect, useRef, useState } from "react";
import { RefreshIcon } from "@/components/shared/icons";
import { useAuth } from "@/components/providers/auth-provider";
import { checkDesktopUpdate } from "@/lib/desktop/updater";

type AvailableUpdateNotice = { version: string; notes: string };

export function DesktopUpdaterProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const checked = useRef(false);
  const [notice, setNotice] = useState<AvailableUpdateNotice | null>(null);

  useEffect(() => {
    if (!user || checked.current) return;
    checked.current = true;
    const timer = window.setTimeout(() => {
      void checkDesktopUpdate(false)
        .then(async (result) => {
          if (!result.update) return;
          setNotice({ version: result.update.version, notes: result.update.body ?? "" });
          await result.update.close().catch(() => undefined);
        })
        .catch(() => undefined);
    }, 4200);
    return () => window.clearTimeout(timer);
  }, [user]);

  return (
    <>
      {children}
      {notice ? (
        <aside className="desktop-update-banner" aria-live="polite">
          <div className="desktop-update-banner-icon"><RefreshIcon /></div>
          <div><strong>FinnacialUX {notice.version} disponível</strong><p>{notice.notes.trim() || "Uma nova versão assinada está pronta para instalação."}</p></div>
          <button type="button" onClick={() => window.location.assign("/configuracoes/#atualizacoes")}>Ver atualização</button>
          <button className="desktop-update-banner-close" type="button" aria-label="Fechar aviso" onClick={() => setNotice(null)}>×</button>
        </aside>
      ) : null}
    </>
  );
}
