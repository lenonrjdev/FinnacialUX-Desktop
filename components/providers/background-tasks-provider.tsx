"use client";

import { useEffect, useRef } from "react";
import { useAuth } from "@/components/providers/auth-provider";
import { useDesktopExperience } from "@/components/providers/desktop-experience-provider";
import { useDesktopSecurity } from "@/components/providers/desktop-security-provider";
import {
  acknowledgeBackgroundNotification,
  flushBackgroundNotifications,
  getBackgroundTaskPreferences,
  listenBackgroundNotifications,
  listenBackgroundRunRequests,
  runBackgroundTasks,
  startBackgroundScheduler,
  stopBackgroundScheduler,
} from "@/lib/desktop/background-tasks";
import { sendNativeNotification } from "@/lib/desktop/experience";
import { hasTauriRuntime } from "@/lib/desktop/runtime";
import type { BackgroundNotification, BackgroundTaskPreferences } from "@/types/background-tasks";

const MINUTE_MS = 60_000;

export function BackgroundTasksProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const { vaultReady } = useDesktopSecurity();
  const { preferences: desktopPreferences, notify } = useDesktopExperience();
  const intervalRef = useRef<number | null>(null);
  const startedRef = useRef(false);
  const desktopNotificationsRef = useRef(desktopPreferences.nativeNotifications);
  const routineNotificationsRef = useRef(true);

  useEffect(() => {
    desktopNotificationsRef.current = desktopPreferences.nativeNotifications;
  }, [desktopPreferences.nativeNotifications]);

  useEffect(() => {
    if (!hasTauriRuntime() || !user || !vaultReady || startedRef.current) return;
    startedRef.current = true;
    let disposed = false;

    const clearTimer = () => {
      if (intervalRef.current !== null) window.clearInterval(intervalRef.current);
      intervalRef.current = null;
    };

    const configureTimer = (preferences: BackgroundTaskPreferences) => {
      routineNotificationsRef.current = preferences.nativeNotifications;
      clearTimer();
      if (!preferences.enabled || preferences.paused) return;
      const intervalMinutes = Math.max(15, Math.min(240, preferences.intervalMinutes));
      intervalRef.current = window.setInterval(() => {
        void runBackgroundTasks(false)
          .then(() => window.dispatchEvent(new CustomEvent("finnacialux-background-updated")))
          .catch(() => undefined);
      }, intervalMinutes * MINUTE_MS);
    };

    const deliver = async (notification: BackgroundNotification) => {
      let delivered = false;
      let failureReason: string | undefined;
      try {
        if (!routineNotificationsRef.current) {
          failureReason = "Notificações das rotinas desativadas.";
        } else if (!desktopNotificationsRef.current) {
          failureReason = "Notificações nativas desativadas nas preferências desktop.";
        } else {
          delivered = await sendNativeNotification(notification.title, notification.body);
          if (!delivered) failureReason = "O Windows não autorizou a entrega da notificação.";
        }
        if (notification.severity === "critical") {
          notify({ kind: "warning", message: notification.title });
        }
      } catch (error) {
        failureReason = error instanceof Error ? error.message : String(error);
      }
      await acknowledgeBackgroundNotification(notification.id, delivered, failureReason).catch(() => undefined);
      window.dispatchEvent(new CustomEvent("finnacialux-background-updated"));
    };

    const refreshPreferences = async (runStartup: boolean) => {
      const preferences = await getBackgroundTaskPreferences();
      if (disposed) return;
      configureTimer(preferences);
      if (preferences.enabled && !preferences.paused) {
        await startBackgroundScheduler(runStartup);
      } else {
        await stopBackgroundScheduler();
      }
    };

    const unlisteners: Array<() => void> = [];
    void listenBackgroundNotifications((notification) => void deliver(notification))
      .then((dispose) => { if (disposed) dispose(); else unlisteners.push(dispose); })
      .catch(() => undefined);
    void listenBackgroundRunRequests(() => {
      void runBackgroundTasks(true)
        .then(() => window.dispatchEvent(new CustomEvent("finnacialux-background-updated")))
        .catch(() => undefined);
    }).then((dispose) => { if (disposed) dispose(); else unlisteners.push(dispose); }).catch(() => undefined);

    void refreshPreferences(true)
      .then(() => flushBackgroundNotifications())
      .catch(() => undefined);

    const handleFocus = () => {
      void flushBackgroundNotifications().catch(() => undefined);
      void runBackgroundTasks(false).catch(() => undefined);
    };
    const handlePreferencesUpdated = () => {
      void refreshPreferences(false)
        .then(() => window.dispatchEvent(new CustomEvent("finnacialux-background-updated")))
        .catch(() => undefined);
    };
    window.addEventListener("focus", handleFocus);
    window.addEventListener("finnacialux-background-preferences-updated", handlePreferencesUpdated);

    return () => {
      disposed = true;
      startedRef.current = false;
      clearTimer();
      unlisteners.forEach((dispose) => dispose());
      window.removeEventListener("focus", handleFocus);
      window.removeEventListener("finnacialux-background-preferences-updated", handlePreferencesUpdated);
      void stopBackgroundScheduler().catch(() => undefined);
    };
  }, [notify, user, vaultReady]);

  return children;
}
