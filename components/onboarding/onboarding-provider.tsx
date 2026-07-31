"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { OnboardingDialog } from "@/components/onboarding/onboarding-dialog";
import { OnboardingProgressDock } from "@/components/onboarding/onboarding-progress-dock";
import { useDesktopExperience } from "@/components/providers/desktop-experience-provider";
import { useDesktopSecurity } from "@/components/providers/desktop-security-provider";
import { useFinanceDocumentsSnapshot, useFinanceDataStatus } from "@/components/providers/finance-data-provider";
import { onboardingSteps } from "@/content/onboarding";
import {
  completeOnboardingStep,
  getOnboardingState,
  resetOnboardingGuide,
  saveOnboardingPreferences,
  skipOnboardingGuide,
  syncOnboardingProgress,
} from "@/lib/desktop/onboarding";
import { hasTauriRuntime } from "@/lib/desktop/runtime";
import { listNativeBackups } from "@/lib/desktop/protection";
import { calculateOnboardingSummary, createDefaultOnboardingSteps, mergeObservedOnboardingProgress } from "@/lib/onboarding-engine";
import type {
  OnboardingObservedState,
  OnboardingState,
  OnboardingStepCode,
  SaveOnboardingPreferencesRequest,
} from "@/types/onboarding";

const OnboardingContext = createContext<{
  state: OnboardingState | null;
  loading: boolean;
  busy: boolean;
  openGuide: () => void;
  skipGuide: () => Promise<void>;
  resetGuide: () => Promise<void>;
  completeStep: (stepCode: OnboardingStepCode) => Promise<void>;
  savePreferences: (preferences: Omit<SaveOnboardingPreferencesRequest, "workspaceId">) => Promise<void>;
} | null>(null);

function arrayLength(value: unknown) {
  return Array.isArray(value) ? value.length : 0;
}

function createBrowserState(workspaceId: string, observed: OnboardingObservedState): OnboardingState {
  const steps = mergeObservedOnboardingProgress(createDefaultOnboardingSteps(), observed);
  const summary = calculateOnboardingSummary(steps);
  return {
    preferences: {
      workspaceId,
      autoOpen: false,
      showProgressDock: true,
      contextualHelpEnabled: true,
      completedAt: null,
      skippedAt: null,
      updatedAt: new Date().toISOString(),
    },
    steps,
    ...summary,
    skipped: false,
    persisted: false,
    readOnly: false,
  };
}

function updateBrowserState(
  current: OnboardingState,
  steps: OnboardingState["steps"],
  preferences = current.preferences,
): OnboardingState {
  const summary = calculateOnboardingSummary(steps);
  const now = new Date().toISOString();
  return {
    ...current,
    preferences: {
      ...preferences,
      completedAt: summary.completed ? (preferences.completedAt ?? now) : null,
      skippedAt: summary.completed ? null : preferences.skippedAt,
      autoOpen: summary.completed ? false : preferences.autoOpen,
      updatedAt: now,
    },
    steps,
    ...summary,
    skipped: summary.completed ? false : preferences.skippedAt !== null,
    persisted: false,
  };
}

export function OnboardingProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { notify } = useDesktopExperience();
  const desktopSecurity = useDesktopSecurity();
  const documents = useFinanceDocumentsSnapshot();
  const financeStatus = useFinanceDataStatus();
  const [state, setState] = useState<OnboardingState | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [nativeBackupCount, setNativeBackupCount] = useState(0);
  const autoOpenedWorkspaceRef = useRef("");
  const observedSignatureRef = useRef("");

  const observed: OnboardingObservedState = {
    accountCount: arrayLength(documents.accounts),
    transactionCount: arrayLength(documents.transactions),
    payableCount: arrayLength(documents.payables),
    receivableCount: arrayLength(documents.receivables),
    budgetCount: arrayLength(documents["monthly-budgets"]),
    goalCount: arrayLength(documents.goals),
    backupCount: Math.max(arrayLength(documents["backup-snapshots"]), nativeBackupCount),
    securityReady: desktopSecurity.vaultReady && (
      desktopSecurity.settings.pinEnabled
      || desktopSecurity.settings.autoLockMinutes > 0
      || desktopSecurity.settings.lockOnMinimize
    ),
  };
  const observedSignature = JSON.stringify(observed);
  const syncSignature = `${financeStatus.workspaceId}:${observedSignature}`;
  const contextualHelpEnabled = state?.preferences.contextualHelpEnabled;

  useEffect(() => {
    if (!hasTauriRuntime()) return;
    let active = true;
    void listNativeBackups()
      .then((records) => {
        if (active) setNativeBackupCount(records.filter((record) => record.status === "available").length);
      })
      .catch(() => undefined);
    return () => { active = false; };
  }, [financeStatus.workspaceId]);

  useEffect(() => {
    if (!financeStatus.workspaceId) return;
    if (!hasTauriRuntime()) {
      setLoading(false);
      return;
    }
    let active = true;
    setLoading(true);
    void getOnboardingState(financeStatus.workspaceId)
      .then((next) => { if (active) setState(next); })
      .catch((caught) => {
        if (active) notify({ kind: "warning", message: caught instanceof Error ? caught.message : String(caught) });
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [financeStatus.workspaceId, notify]);

  useEffect(() => {
    if (financeStatus.loading || !financeStatus.workspaceId) return;
    if (syncSignature === observedSignatureRef.current) return;
    observedSignatureRef.current = syncSignature;
    const currentObserved = JSON.parse(observedSignature) as OnboardingObservedState;
    if (!hasTauriRuntime()) {
      setState(createBrowserState(financeStatus.workspaceId, currentObserved));
      return;
    }
    void syncOnboardingProgress({ workspaceId: financeStatus.workspaceId, observed: currentObserved })
      .then(setState)
      .catch(() => undefined);
  }, [financeStatus.loading, financeStatus.workspaceId, observedSignature, syncSignature]);


  useEffect(() => {
    if (contextualHelpEnabled === undefined || typeof window === "undefined") return;
    window.localStorage.setItem(
      "finnacialux-contextual-help-enabled",
      String(contextualHelpEnabled),
    );
  }, [contextualHelpEnabled]);

  useEffect(() => {
    if (!state || loading || state.completed || state.skipped || !state.preferences.autoOpen) return;
    if (autoOpenedWorkspaceRef.current === state.preferences.workspaceId) return;
    autoOpenedWorkspaceRef.current = state.preferences.workspaceId;
    setDialogOpen(true);
  }, [loading, state]);

  const completeStep = useCallback(async (stepCode: OnboardingStepCode) => {
    if (!state || state.readOnly) return;
    setBusy(true);
    try {
      const next = hasTauriRuntime()
        ? await completeOnboardingStep(state.preferences.workspaceId, stepCode)
        : updateBrowserState(
            state,
            state.steps.map((step) => step.code === stepCode
              ? { ...step, status: "completed" as const, completedAt: new Date().toISOString() }
              : step),
          );
      setState(next);
      notify({ kind: "success", message: "Etapa dos primeiros passos concluída." });
    } catch (caught) {
      notify({ kind: "error", message: caught instanceof Error ? caught.message : String(caught) });
    } finally {
      setBusy(false);
    }
  }, [notify, state]);

  const skipGuide = useCallback(async () => {
    if (!state || state.readOnly) return;
    setBusy(true);
    try {
      const now = new Date().toISOString();
      const next = hasTauriRuntime()
        ? await skipOnboardingGuide({ workspaceId: state.preferences.workspaceId, reason: "Guia adiado pela interface." })
        : updateBrowserState(state, state.steps, {
            ...state.preferences,
            autoOpen: false,
            skippedAt: now,
            updatedAt: now,
          });
      setState(next);
      setDialogOpen(false);
      notify({ kind: "info", message: "O guia foi adiado. Ele continua disponível em Configurações e na central de comandos." });
    } catch (caught) {
      notify({ kind: "error", message: caught instanceof Error ? caught.message : String(caught) });
    } finally {
      setBusy(false);
    }
  }, [notify, state]);

  const resetGuide = useCallback(async () => {
    if (!state || state.readOnly) return;
    setBusy(true);
    try {
      const next = hasTauriRuntime()
        ? await resetOnboardingGuide(state.preferences.workspaceId)
        : createBrowserState(
            state.preferences.workspaceId,
            JSON.parse(observedSignature) as OnboardingObservedState,
          );
      setState(next);
      setDialogOpen(true);
      notify({ kind: "success", message: "O guia de primeiros passos foi reiniciado." });
    } catch (caught) {
      notify({ kind: "error", message: caught instanceof Error ? caught.message : String(caught) });
    } finally {
      setBusy(false);
    }
  }, [notify, observedSignature, state]);

  const savePreferences = useCallback(async (preferences: Omit<SaveOnboardingPreferencesRequest, "workspaceId">) => {
    if (!state || state.readOnly) return;
    setBusy(true);
    try {
      const now = new Date().toISOString();
      const next = hasTauriRuntime()
        ? await saveOnboardingPreferences({ workspaceId: state.preferences.workspaceId, ...preferences })
        : updateBrowserState(state, state.steps, {
            ...state.preferences,
            ...preferences,
            updatedAt: now,
          });
      setState(next);
      notify({ kind: "success", message: "Preferências dos primeiros passos atualizadas." });
    } catch (caught) {
      notify({ kind: "error", message: caught instanceof Error ? caught.message : String(caught) });
    } finally {
      setBusy(false);
    }
  }, [notify, state]);

  useEffect(() => {
    const open = () => setDialogOpen(true);
    const reset = () => void resetGuide();
    window.addEventListener("finnacialux-onboarding-open-request", open);
    window.addEventListener("finnacialux-onboarding-reset-request", reset);
    return () => {
      window.removeEventListener("finnacialux-onboarding-open-request", open);
      window.removeEventListener("finnacialux-onboarding-reset-request", reset);
    };
  }, [resetGuide]);

  function openStep(stepCode: OnboardingStepCode) {
    const definition = onboardingSteps.find((step) => step.code === stepCode);
    if (!definition) return;
    setDialogOpen(false);
    router.push(definition.href);
  }

  return (
    <OnboardingContext.Provider value={{
      state,
      loading,
      busy,
      openGuide: () => setDialogOpen(true),
      skipGuide,
      resetGuide,
      completeStep,
      savePreferences,
    }}>
      {children}
      {state ? (
        <>
          <OnboardingDialog
            open={dialogOpen}
            state={state}
            busy={busy}
            onClose={() => setDialogOpen(false)}
            onSkip={() => void skipGuide()}
            onCompleteWelcome={() => void completeStep("welcome")}
            onOpenStep={openStep}
          />
          <OnboardingProgressDock
            state={state}
            onOpen={() => setDialogOpen(true)}
            onDismiss={() => void savePreferences({
              autoOpen: false,
              showProgressDock: false,
              contextualHelpEnabled: state.preferences.contextualHelpEnabled,
            })}
          />
        </>
      ) : null}
    </OnboardingContext.Provider>
  );
}

export function useOnboarding() {
  const value = useContext(OnboardingContext);
  if (!value) throw new Error("useOnboarding precisa estar dentro de OnboardingProvider.");
  return value;
}
