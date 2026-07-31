"use client";

import { CheckIcon, RefreshIcon, ShieldIcon } from "@/components/shared/icons";
import { useOnboarding } from "@/components/onboarding/onboarding-provider";
import { onboardingSteps } from "@/content/onboarding";

export function OnboardingSettingsPanel() {
  const { state, loading, busy, openGuide, resetGuide, savePreferences } = useOnboarding();

  if (loading || !state) {
    return <section className="settings-panel onboarding-settings-panel"><p>Carregando preferências dos primeiros passos...</p></section>;
  }

  return (
    <section className="settings-panel onboarding-settings-panel" aria-labelledby="onboarding-settings-title">
      <header className="settings-panel-heading">
        <span><ShieldIcon /></span>
        <div>
          <span className="section-eyebrow">Experiência guiada</span>
          <h2 id="onboarding-settings-title">Primeiros passos e ajuda contextual</h2>
          <p>Controle quando o guia aparece e como as orientações são apresentadas neste espaço financeiro.</p>
        </div>
      </header>

      <div className="onboarding-settings-summary">
        <div><strong>{state.progressPercent}%</strong><span>{state.completedSteps} de {state.totalSteps} etapas concluídas</span></div>
        <div className="onboarding-progress-track"><span style={{ width: `${state.progressPercent}%` }} /></div>
        <p>{state.completed ? "A configuração essencial foi concluída." : state.skipped ? "O guia está adiado, mas pode ser retomado." : "O guia acompanha somente evidências reais dos seus dados locais."}</p>
      </div>

      <div className="onboarding-settings-options">
        <label>
          <span><strong>Abrir automaticamente</strong><small>Mostra o guia em um espaço que ainda não concluiu a configuração.</small></span>
          <input
            type="checkbox"
            checked={state.preferences.autoOpen}
            disabled={busy || state.readOnly}
            onChange={(event) => void savePreferences({
              autoOpen: event.target.checked,
              showProgressDock: state.preferences.showProgressDock,
              contextualHelpEnabled: state.preferences.contextualHelpEnabled,
            })}
          />
        </label>
        <label>
          <span><strong>Lembrete compacto</strong><small>Mantém o próximo passo visível no canto da interface.</small></span>
          <input
            type="checkbox"
            checked={state.preferences.showProgressDock}
            disabled={busy || state.readOnly}
            onChange={(event) => void savePreferences({
              autoOpen: state.preferences.autoOpen,
              showProgressDock: event.target.checked,
              contextualHelpEnabled: state.preferences.contextualHelpEnabled,
            })}
          />
        </label>
        <label>
          <span><strong>Ajuda contextual</strong><small>Permite abrir orientações específicas da tela atual com F1.</small></span>
          <input
            type="checkbox"
            checked={state.preferences.contextualHelpEnabled}
            disabled={busy || state.readOnly}
            onChange={(event) => void savePreferences({
              autoOpen: state.preferences.autoOpen,
              showProgressDock: state.preferences.showProgressDock,
              contextualHelpEnabled: event.target.checked,
            })}
          />
        </label>
      </div>

      <div className="onboarding-settings-steps">
        {onboardingSteps.map((definition) => {
          const step = state.steps.find((item) => item.code === definition.code);
          return <p key={definition.code} className={step?.status === "completed" ? "completed" : ""}><CheckIcon /><span><strong>{definition.title}</strong><small>{step?.status === "completed" ? "Concluída" : "Pendente"}</small></span></p>;
        })}
      </div>

      <footer className="onboarding-settings-actions">
        <button type="button" className="primary-action-button" onClick={openGuide}>Abrir guia</button>
        <button type="button" className="secondary-action-button" disabled={busy || state.readOnly} onClick={() => void resetGuide()}><RefreshIcon /> Reiniciar progresso</button>
      </footer>
    </section>
  );
}
