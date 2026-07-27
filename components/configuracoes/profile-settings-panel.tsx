import { InfoIcon, UserIcon } from "@/components/shared/icons";
import { settingsContent } from "@/content/configuracoes";
import { createInitials } from "@/lib/access-control";
import type { ProfileSettings } from "@/types/configuracoes";

export function ProfileSettingsPanel({
  value,
  onChange,
}: {
  value: ProfileSettings;
  onChange: (value: ProfileSettings) => void;
}) {
  return (
    <section className="settings-panel settings-profile-panel">
      <header className="settings-panel-header">
        <div>
          <span className="section-eyebrow">{settingsContent.views.profile}</span>
          <h2>{settingsContent.profile.title}</h2>
          <p>{settingsContent.profile.description}</p>
        </div>
        <span className="settings-panel-icon"><UserIcon /></span>
      </header>

      <div className="profile-settings-layout">
        <aside className="profile-identity-card">
          <span className="profile-large-avatar">{createInitials(value.name) || "U"}</span>
          <strong>{value.name || "Usuário"}</strong>
          <small>{value.email}</small>
          <dl>
            <div><dt>{settingsContent.profile.initials}</dt><dd>{createInitials(value.name) || "U"}</dd></div>
            <div><dt>{settingsContent.profile.timeZone}</dt><dd>Brasília</dd></div>
          </dl>
        </aside>

        <div className="settings-form-grid profile-settings-form">
          <label className="form-field settings-field full">
            <span>{settingsContent.profile.name}</span>
            <input value={value.name} onChange={(event) => onChange({ ...value, name: event.target.value })} />
          </label>
          <label className="form-field settings-field">
            <span>{settingsContent.profile.email}</span>
            <input type="email" value={value.email} onChange={(event) => onChange({ ...value, email: event.target.value })} />
          </label>
          <label className="form-field settings-field">
            <span>{settingsContent.profile.phone}</span>
            <input value={value.phone} onChange={(event) => onChange({ ...value, phone: event.target.value })} />
          </label>
          <label className="form-field settings-field full">
            <span>{settingsContent.profile.timeZone}</span>
            <select value={value.timeZone} onChange={(event) => onChange({ ...value, timeZone: event.target.value })}>
              <option value="America/Sao_Paulo">Brasília — America/Sao_Paulo</option>
              <option value="America/Manaus">Manaus — America/Manaus</option>
              <option value="America/Rio_Branco">Rio Branco — America/Rio_Branco</option>
              <option value="America/Noronha">Fernando de Noronha — America/Noronha</option>
            </select>
          </label>
          <p className="settings-inline-note full"><InfoIcon /> {settingsContent.profile.identityNote}</p>
        </div>
      </div>
    </section>
  );
}
