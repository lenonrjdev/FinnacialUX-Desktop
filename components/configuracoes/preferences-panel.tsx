import { EyeOffIcon, PaletteIcon } from "@/components/shared/icons";
import { settingsContent } from "@/content/configuracoes";
import type { FinancialAccount } from "@/types/contas";
import type { AppearanceMode, DateFormat, FinancialPreferences } from "@/types/configuracoes";

export function PreferencesPanel({
  value,
  accounts,
  onChange,
}: {
  value: FinancialPreferences;
  accounts: FinancialAccount[];
  onChange: (value: FinancialPreferences) => void;
}) {
  return (
    <section className="settings-panel">
      <header className="settings-panel-header">
        <div>
          <span className="section-eyebrow">{settingsContent.views.preferences}</span>
          <h2>{settingsContent.preferences.title}</h2>
          <p>{settingsContent.preferences.description}</p>
        </div>
        <span className="settings-panel-icon"><PaletteIcon /></span>
      </header>

      <div className="settings-panel-body preferences-body">
        <div className="settings-form-grid">
          <label className="form-field settings-field">
            <span>{settingsContent.preferences.currency}</span>
            <select value={value.currency} onChange={() => undefined}>
              <option value="BRL">{settingsContent.preferences.brl}</option>
            </select>
          </label>
          <label className="form-field settings-field">
            <span>{settingsContent.preferences.locale}</span>
            <select value={value.locale} onChange={() => undefined}>
              <option value="pt-BR">{settingsContent.preferences.brazil}</option>
            </select>
          </label>
          <label className="form-field settings-field">
            <span>{settingsContent.preferences.dateFormat}</span>
            <select value={value.dateFormat} onChange={(event) => onChange({ ...value, dateFormat: event.target.value as DateFormat })}>
              <option value="dd/MM/yyyy">25/07/2026</option>
              <option value="MM/dd/yyyy">07/25/2026</option>
              <option value="yyyy-MM-dd">2026-07-25</option>
            </select>
          </label>
          <label className="form-field settings-field">
            <span>{settingsContent.preferences.monthStart}</span>
            <select value={value.financialMonthStartDay} onChange={(event) => onChange({ ...value, financialMonthStartDay: Number(event.target.value) })}>
              {[1, 5, 10, 15, 20, 25].map((day) => <option value={day} key={day}>Dia {day}</option>)}
            </select>
            <small>{settingsContent.preferences.monthStartHelper}</small>
          </label>
          <label className="form-field settings-field full">
            <span>{settingsContent.preferences.defaultAccount}</span>
            <select value={value.defaultAccountId} onChange={(event) => onChange({ ...value, defaultAccountId: event.target.value })}>
              <option value="">Nenhuma conta padrão</option>
              {accounts.map((account) => <option value={account.id} key={account.id}>{account.name}</option>)}
            </select>
          </label>
        </div>

        <div className="appearance-settings-block">
          <div className="settings-subheading">
            <div><h3>{settingsContent.preferences.appearance}</h3><p>{settingsContent.preferences.description}</p></div>
          </div>
          <div className="appearance-options">
            {(["light", "dark", "system"] as AppearanceMode[]).map((appearance) => (
              <button
                className={value.appearance === appearance ? "active" : ""}
                type="button"
                key={appearance}
                onClick={() => onChange({ ...value, appearance })}
              >
                <span className={`appearance-preview ${appearance}`}><i /><i /><i /></span>
                <strong>{settingsContent.preferences[appearance]}</strong>
              </button>
            ))}
          </div>
        </div>

        <div className="settings-toggle-group">
          <div className="settings-subheading"><div><h3>{settingsContent.preferences.privacyTitle}</h3></div><EyeOffIcon /></div>
          <ToggleSetting
            label={settingsContent.preferences.hideBalances}
            helper={settingsContent.preferences.hideBalancesHelper}
            checked={value.hideBalancesOnOpen}
            onChange={(checked) => onChange({ ...value, hideBalancesOnOpen: checked })}
          />
          <ToggleSetting
            label={settingsContent.preferences.compactNumbers}
            helper={settingsContent.preferences.compactNumbersHelper}
            checked={value.compactNumbers}
            onChange={(checked) => onChange({ ...value, compactNumbers: checked })}
          />
        </div>
      </div>
    </section>
  );
}

function ToggleSetting({ label, helper, checked, onChange }: { label: string; helper: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <label className="settings-toggle-row">
      <span><strong>{label}</strong><small>{helper}</small></span>
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
      <i aria-hidden="true" />
    </label>
  );
}
