"use client";

import { CheckIcon, CloseIcon } from "@/components/shared/icons";
import { onboardingSteps } from "@/content/onboarding";
import type { OnboardingState } from "@/types/onboarding";

export function OnboardingProgressDock({
  state,
  onOpen,
  onDismiss,
}: {
  state: OnboardingState;
  onOpen: () => void;
  onDismiss: () => void;
}) {
  const next = onboardingSteps.find((step) => step.code === state.nextStep);
  if (state.completed || state.skipped || !state.preferences.showProgressDock) return null;

  return (
    <aside className="onboarding-progress-dock" aria-label="Progresso dos primeiros passos">
      <button type="button" className="onboarding-dock-main" onClick={onOpen}>
        <span className="onboarding-dock-ring" style={{ "--progress": `${state.progressPercent * 3.6}deg` } as React.CSSProperties}>
          <strong>{state.progressPercent}%</strong>
        </span>
        <span><small>Próximo passo</small><strong>{next?.title ?? "Revisar configuração"}</strong><em>Continuar primeiros passos</em></span>
      </button>
      <button type="button" className="onboarding-dock-close" onClick={onDismiss} aria-label="Ocultar lembrete dos primeiros passos"><CloseIcon /></button>
      {state.completedSteps > 0 ? <span className="onboarding-dock-count"><CheckIcon /> {state.completedSteps}/{state.totalSteps}</span> : null}
    </aside>
  );
}
