"use client";

import { EyeIcon, MonitorIcon, PaletteIcon, SearchIcon } from "@/components/shared/icons";
import { useDesktopExperience } from "@/components/providers/desktop-experience-provider";
import type { DesktopExperiencePreferences, DesktopTextScale } from "@/types/desktop-experience";

export function AccessibilityPanel() {
  const { preferences, updatePreferences, notify } = useDesktopExperience();

  async function change<K extends keyof DesktopExperiencePreferences>(key: K, value: DesktopExperiencePreferences[K]) {
    try {
      await updatePreferences({ ...preferences, [key]: value });
      notify({ kind: "success", message: "A preferência de acessibilidade foi aplicada imediatamente." });
    } catch (caught) {
      notify({ kind: "error", message: caught instanceof Error ? caught.message : String(caught) });
    }
  }

  return (
    <div className="accessibility-settings-layout">
      <section className="settings-panel accessibility-main-panel">
        <header className="settings-panel-header">
          <div><span className="section-eyebrow">Aparência e acessibilidade</span><h2>Leitura, foco e movimento</h2><p>As alterações são aplicadas em toda a interface e permanecem neste computador.</p></div>
          <span className="desktop-feature-badge"><EyeIcon /> Acessível</span>
        </header>

        <div className="accessibility-option-list">
          <label className="desktop-setting-row">
            <span className="desktop-setting-icon"><MonitorIcon /></span>
            <span><strong>Reduzir animações</strong><small>Remove transições, movimentos decorativos e indicadores contínuos.</small></span>
            <input type="checkbox" checked={preferences.reduceMotion} onChange={(event) => void change("reduceMotion", event.target.checked)} />
          </label>
          <label className="desktop-setting-row">
            <span className="desktop-setting-icon"><PaletteIcon /></span>
            <span><strong>Aumentar contraste</strong><small>Reforça bordas, textos secundários e separação entre superfícies.</small></span>
            <input type="checkbox" checked={preferences.highContrast} onChange={(event) => void change("highContrast", event.target.checked)} />
          </label>
          <label className="desktop-setting-row">
            <span className="desktop-setting-icon"><SearchIcon /></span>
            <span><strong>Destacar foco do teclado</strong><small>Mostra um contorno mais evidente ao navegar sem mouse.</small></span>
            <input type="checkbox" checked={preferences.enhancedFocus} onChange={(event) => void change("enhancedFocus", event.target.checked)} />
          </label>
          <label className="desktop-setting-row">
            <span className="desktop-setting-icon"><MonitorIcon /></span>
            <span><strong>Interface compacta</strong><small>Reduz espaçamentos de listas e painéis sem diminuir a legibilidade.</small></span>
            <input type="checkbox" checked={preferences.compactInterface} onChange={(event) => void change("compactInterface", event.target.checked)} />
          </label>
        </div>
      </section>

      <section className="settings-panel accessibility-text-panel">
        <header className="settings-panel-header compact"><div><span className="section-eyebrow">Escala do conteúdo</span><h2>Tamanho do texto</h2><p>Adapta a interface independentemente da escala configurada no Windows.</p></div></header>
        <div className="accessibility-scale-options" role="radiogroup" aria-label="Tamanho do texto">
          {([90, 100, 110, 120] as DesktopTextScale[]).map((scale) => (
            <button
              type="button"
              role="radio"
              aria-checked={preferences.textScale === scale}
              className={preferences.textScale === scale ? "active" : ""}
              key={scale}
              onClick={() => void change("textScale", scale)}
            >
              <span style={{ fontSize: `${scale / 100}rem` }}>Aa</span>
              <strong>{scale}%</strong>
              <small>{scale === 90 ? "Compacto" : scale === 100 ? "Padrão" : scale === 110 ? "Confortável" : "Ampliado"}</small>
            </button>
          ))}
        </div>
      </section>

      <section className="settings-panel accessibility-preview-panel">
        <header className="settings-panel-header compact"><div><span className="section-eyebrow">Pré-visualização</span><h2>Exemplo de leitura</h2></div></header>
        <div className="accessibility-preview-card">
          <span>Resumo financeiro</span>
          <strong>Saldo disponível protegido</strong>
          <p>O FinnacialUX mantém os dados localmente e apresenta informações com hierarquia clara, foco visível e controles acessíveis.</p>
          <button type="button">Botão de exemplo</button>
        </div>
      </section>
    </div>
  );
}
