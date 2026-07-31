"use client";

import { useEffect, useRef } from "react";
import { CheckIcon, CloseIcon, ShieldIcon } from "@/components/shared/icons";
import { onboardingContent, onboardingSteps } from "@/content/onboarding";
import type { OnboardingState, OnboardingStepCode } from "@/types/onboarding";

export function OnboardingDialog({
  open,
  state,
  busy,
  onClose,
  onSkip,
  onCompleteWelcome,
  onOpenStep,
}: {
  open: boolean;
  state: OnboardingState;
  busy: boolean;
  onClose: () => void;
  onSkip: () => void;
  onCompleteWelcome: () => void;
  onOpenStep: (stepCode: OnboardingStepCode) => void;
}) {
  const dialogRef = useRef<HTMLElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    previousFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const timer = window.setTimeout(() => dialogRef.current?.focus(), 20);
    return () => {
      window.clearTimeout(timer);
      document.body.style.overflow = previousOverflow;
      previousFocusRef.current?.focus();
    };
  }, [open]);

  if (!open) return null;

  return (
    <div className="onboarding-overlay" role="presentation" onMouseDown={(event) => {
      if (event.currentTarget === event.target) onClose();
    }}>
      <section
        ref={dialogRef}
        className="onboarding-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="onboarding-title"
        tabIndex={-1}
        onKeyDown={(event) => {
          if (event.key === "Escape") onClose();
        }}
      >
        <header className="onboarding-dialog-header">
          <div className="onboarding-dialog-icon"><ShieldIcon /></div>
          <div>
            <span className="section-eyebrow">Configuração guiada</span>
            <h2 id="onboarding-title">{onboardingContent.title}</h2>
            <p>{onboardingContent.description}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Fechar primeiros passos"><CloseIcon /></button>
        </header>

        <div className="onboarding-progress-summary">
          <div><strong>{state.progressPercent}%</strong><span>{state.completedSteps} de {state.totalSteps} etapas concluídas</span></div>
          <div className="onboarding-progress-track" aria-label={`${state.progressPercent}% concluído`}><span style={{ width: `${state.progressPercent}%` }} /></div>
          {state.readOnly ? <p role="status">O modo somente leitura está ativo. O guia pode ser consultado, mas o progresso não será salvo.</p> : null}
        </div>

        <div className="onboarding-step-list">
          {onboardingSteps.map((definition, index) => {
            const step = state.steps.find((item) => item.code === definition.code);
            const completed = step?.status === "completed";
            const current = !state.completed && state.nextStep === definition.code;
            return (
              <article className={`onboarding-step ${completed ? "completed" : ""} ${current ? "current" : ""}`} key={definition.code}>
                <span className="onboarding-step-number">{completed ? <CheckIcon /> : String(index + 1).padStart(2, "0")}</span>
                <div className="onboarding-step-copy">
                  <small>{definition.eyebrow}</small>
                  <strong>{definition.title}</strong>
                  <p>{definition.description}</p>
                </div>
                {completed ? (
                  <span className="onboarding-step-status"><CheckIcon /> Concluída</span>
                ) : (
                  <button type="button" disabled={busy} onClick={() => {
                    if (definition.code === "welcome") onCompleteWelcome();
                    else onOpenStep(definition.code);
                  }}>
                    {definition.actionLabel}
                  </button>
                )}
              </article>
            );
          })}
        </div>

        <footer className="onboarding-dialog-footer">
          <button type="button" className="secondary-action-button" disabled={busy || state.readOnly} onClick={onSkip}>{onboardingContent.skipLabel}</button>
          <button type="button" className="primary-action-button" onClick={onClose}>{state.completed ? "Concluir" : "Continuar no aplicativo"}</button>
        </footer>
      </section>
    </div>
  );
}
