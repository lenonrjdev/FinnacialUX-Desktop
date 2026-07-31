"use client";

import { CheckIcon, ShieldIcon } from "@/components/shared/icons";
import { useOnboarding } from "@/components/onboarding/onboarding-provider";
import { onboardingContent, onboardingSteps } from "@/content/onboarding";

export function FirstStepsPanel() {
  const { state, loading, openGuide } = useOnboarding();
  if (loading || !state || state.completed || state.skipped) return null;
  const next = onboardingSteps.find((step) => step.code === state.nextStep);

  return (
    <section className="overview-first-steps" aria-labelledby="overview-first-steps-title">
      <div className="overview-first-steps-icon"><ShieldIcon /></div>
      <div className="overview-first-steps-copy">
        <span className="section-eyebrow">Configuração do espaço</span>
        <h2 id="overview-first-steps-title">{next?.title ?? onboardingContent.title}</h2>
        <p>{next?.description ?? onboardingContent.description}</p>
        <div><span><CheckIcon /> {state.completedSteps} etapas concluídas</span><span>{state.progressPercent}% preparado</span></div>
      </div>
      <button type="button" className="primary-action-button" onClick={openGuide}>{onboardingContent.resumeLabel}</button>
    </section>
  );
}
