"use client";

import { useEffect, useRef, useState } from "react";
import { RefreshIcon } from "@/components/shared/icons";
import { useAuth } from "@/components/providers/auth-provider";
import { checkDesktopUpdate } from "@/lib/desktop/updater";
import { isWithinMaintenanceWindow } from "@/lib/maintenance-engine";
import { loadMaintenancePreferences, recordLocalTechnicalError } from "@/lib/maintenance-preferences";

type AvailableUpdateNotice = { version: string; notes: string };

export function DesktopUpdaterProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const checked = useRef(false);
  const [notice, setNotice] = useState<AvailableUpdateNotice | null>(null);
  const [maintenanceNotice, setMaintenanceNotice] = useState(false);

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

  useEffect(() => {
    const onError = (event: ErrorEvent) => recordLocalTechnicalError(event.message, "window");
    const onRejection = (event: PromiseRejectionEvent) => {
      const message = event.reason instanceof Error ? event.reason.message : String(event.reason);
      recordLocalTechnicalError(message, "promise");
    };
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);

  useEffect(() => {
    if (!user) return;
    const timer = window.setTimeout(() => {
      const preferences = loadMaintenancePreferences();
      const last = preferences.lastMaintenanceAt ? Date.parse(preferences.lastMaintenanceAt) : 0;
      const completedToday = last > 0 && new Date(last).toDateString() === new Date().toDateString();
      setMaintenanceNotice(preferences.automaticMaintenance && !completedToday && isWithinMaintenanceWindow(preferences));
    }, 6000);
    return () => window.clearTimeout(timer);
  }, [user]);

  return (
    <>
      {children}
      {maintenanceNotice ? (
        <aside className="desktop-update-banner" aria-live="polite">
          <div className="desktop-update-banner-icon"><RefreshIcon /></div>
          <div><strong>Janela de manutenção aberta</strong><p>Revise backup, diagnóstico e atualizações no ciclo programado.</p></div>
          <button type="button" onClick={() => window.location.assign("/configuracoes/#manutencao")}>Abrir manutenção</button>
          <button className="desktop-update-banner-close" type="button" aria-label="Fechar aviso" onClick={() => setMaintenanceNotice(false)}>×</button>
        </aside>
      ) : notice ? (
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
