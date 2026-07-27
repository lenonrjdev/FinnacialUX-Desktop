import { useState } from "react";
import {
  CheckIcon,
  DesktopIcon,
  KeyIcon,
  LockIcon,
  LogOutIcon,
  MobileIcon,
  ShieldIcon,
  TabletIcon,
} from "@/components/shared/icons";
import { settingsContent } from "@/content/configuracoes";
import { formatSettingsDateTime } from "@/lib/settings";
import type { ActiveSession, PasswordChangeInput, SecuritySettings } from "@/types/configuracoes";

export function SecurityPanel({
  value,
  sessions,
  onChange,
  onSessionsChange,
  onFeedback,
}: {
  value: SecuritySettings;
  sessions: ActiveSession[];
  onChange: (value: SecuritySettings) => void;
  onSessionsChange: (sessions: ActiveSession[]) => void;
  onFeedback: (message: string) => void;
}) {
  const [password, setPassword] = useState<PasswordChangeInput>({ currentPassword: "", newPassword: "", confirmation: "" });
  const [passwordError, setPasswordError] = useState("");

  function changePassword(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const valid = password.currentPassword.length >= 1
      && password.newPassword.length >= 8
      && /[A-Za-z]/.test(password.newPassword)
      && /\d/.test(password.newPassword)
      && password.newPassword === password.confirmation;

    if (!valid) {
      setPasswordError(settingsContent.security.invalidPassword);
      return;
    }

    setPassword({ currentPassword: "", newPassword: "", confirmation: "" });
    setPasswordError("");
    onFeedback(settingsContent.security.passwordChanged);
  }

  function revokeSession(sessionId: string) {
    onSessionsChange(sessions.filter((session) => session.id !== sessionId));
    onFeedback(settingsContent.feedback.sessionRevoked);
  }

  function revokeOtherSessions() {
    onSessionsChange(sessions.filter((session) => session.current));
    onFeedback(settingsContent.feedback.otherSessionsRevoked);
  }

  return (
    <div className="security-settings-layout">
      <section className="settings-panel">
        <header className="settings-panel-header">
          <div>
            <span className="section-eyebrow">{settingsContent.views.security}</span>
            <h2>{settingsContent.security.title}</h2>
            <p>{settingsContent.security.description}</p>
          </div>
          <span className="settings-panel-icon"><ShieldIcon /></span>
        </header>

        <div className="settings-panel-body security-controls-body">
          <div className="security-toggle-list">
            <SecurityToggle
              icon={<KeyIcon />}
              title={settingsContent.security.twoFactor}
              helper={settingsContent.security.twoFactorHelper}
              checked={value.twoFactorEnabled}
              onChange={(checked) => {
                onChange({ ...value, twoFactorEnabled: checked });
                onFeedback(checked ? settingsContent.security.twoFactorEnabled : settingsContent.security.twoFactorDisabled);
              }}
            />
            <SecurityToggle
              icon={<ShieldIcon />}
              title={settingsContent.security.loginAlerts}
              helper={settingsContent.security.loginAlertsHelper}
              checked={value.loginAlerts}
              onChange={(checked) => onChange({ ...value, loginAlerts: checked })}
            />
            <SecurityToggle
              icon={<LockIcon />}
              title={settingsContent.security.exportProtection}
              helper={settingsContent.security.exportProtectionHelper}
              checked={value.requirePasswordForExports}
              onChange={(checked) => onChange({ ...value, requirePasswordForExports: checked })}
            />
          </div>

          <label className="form-field settings-field security-timeout-field">
            <span>{settingsContent.security.timeout}</span>
            <select value={value.sessionTimeoutMinutes} onChange={(event) => onChange({ ...value, sessionTimeoutMinutes: Number(event.target.value) })}>
              <option value={15}>15 minutos</option>
              <option value={30}>30 minutos</option>
              <option value={60}>1 hora</option>
              <option value={240}>4 horas</option>
              <option value={720}>12 horas</option>
            </select>
          </label>
        </div>
      </section>

      <section className="settings-panel password-panel">
        <header className="settings-panel-header compact">
          <div>
            <span className="section-eyebrow">{settingsContent.views.security}</span>
            <h2>{settingsContent.security.passwordTitle}</h2>
          </div>
          <span className="settings-panel-icon"><LockIcon /></span>
        </header>
        <form className="password-settings-form" onSubmit={changePassword}>
          <label className="form-field settings-field full"><span>{settingsContent.security.currentPassword}</span><input type="password" value={password.currentPassword} onChange={(event) => setPassword({ ...password, currentPassword: event.target.value })} /></label>
          <label className="form-field settings-field"><span>{settingsContent.security.newPassword}</span><input type="password" value={password.newPassword} onChange={(event) => setPassword({ ...password, newPassword: event.target.value })} /></label>
          <label className="form-field settings-field"><span>{settingsContent.security.confirmation}</span><input type="password" value={password.confirmation} onChange={(event) => setPassword({ ...password, confirmation: event.target.value })} /></label>
          <p className={`password-rule ${passwordError ? "error" : ""}`}>{passwordError || settingsContent.security.passwordRule}</p>
          <button className="secondary-action-button" type="submit"><KeyIcon /> {settingsContent.security.changePassword}</button>
        </form>
      </section>

      <section className="settings-panel active-sessions-panel">
        <header className="settings-panel-header sessions-header">
          <div>
            <span className="section-eyebrow">{settingsContent.views.security}</span>
            <h2>{settingsContent.security.sessionsTitle}</h2>
            <p>{settingsContent.security.sessionsDescription}</p>
          </div>
          {sessions.some((session) => !session.current) ? <button className="secondary-action-button" type="button" onClick={revokeOtherSessions}><LogOutIcon /> {settingsContent.security.revokeOthers}</button> : null}
        </header>
        <div className="active-session-list">
          {sessions.map((session) => (
            <article key={session.id}>
              <span className="session-device-icon">{session.deviceType === "desktop" ? <DesktopIcon /> : session.deviceType === "mobile" ? <MobileIcon /> : <TabletIcon />}</span>
              <div className="session-main-copy">
                <div><strong>{session.deviceName}</strong>{session.current ? <span className="current-session-badge"><CheckIcon /> {settingsContent.security.currentSession}</span> : null}</div>
                <small>{session.browser} · {session.location}</small>
              </div>
              <dl>
                <div><dt>Última atividade</dt><dd>{formatSettingsDateTime(session.lastActiveAt)}</dd></div>
                <div><dt>Endereço IP</dt><dd>{session.ipAddress}</dd></div>
              </dl>
              {!session.current ? <button type="button" onClick={() => revokeSession(session.id)}><LogOutIcon /> {settingsContent.security.revoke}</button> : null}
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

function SecurityToggle({ icon, title, helper, checked, onChange }: { icon: React.ReactNode; title: string; helper: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <article className="security-toggle-row">
      <span className="security-toggle-icon">{icon}</span>
      <span><strong>{title}</strong><small>{helper}</small></span>
      <label className="standalone-toggle"><input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} /><i /></label>
    </article>
  );
}
