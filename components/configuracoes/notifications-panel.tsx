import { BellIcon, MailIcon, MonitorIcon } from "@/components/shared/icons";
import { settingsContent } from "@/content/configuracoes";
import { formatCurrency } from "@/lib/formatters";
import type { NotificationSettings } from "@/types/configuracoes";

export function NotificationsPanel({ value, onChange }: { value: NotificationSettings; onChange: (value: NotificationSettings) => void }) {
  return (
    <section className="settings-panel">
      <header className="settings-panel-header">
        <div>
          <span className="section-eyebrow">{settingsContent.views.notifications}</span>
          <h2>{settingsContent.notifications.title}</h2>
          <p>{settingsContent.notifications.description}</p>
        </div>
        <span className="settings-panel-icon"><BellIcon /></span>
      </header>

      <div className="settings-panel-body notification-settings-body">
        <div className="notification-setting-list">
          <NotificationRow
            title={settingsContent.notifications.billsDue}
            helper={settingsContent.notifications.billsDueHelper}
            checked={value.billsDue}
            onChange={(checked) => onChange({ ...value, billsDue: checked })}
          >
            <label className="notification-inline-control">
              <span>{settingsContent.notifications.daysBefore}</span>
              <select disabled={!value.billsDue} value={value.billsDueDaysBefore} onChange={(event) => onChange({ ...value, billsDueDaysBefore: Number(event.target.value) })}>
                {[1, 2, 3, 5, 7].map((day) => <option value={day} key={day}>{day} {day === 1 ? "dia" : "dias"}</option>)}
              </select>
            </label>
          </NotificationRow>

          <NotificationRow
            title={settingsContent.notifications.receivablesDue}
            helper={settingsContent.notifications.receivablesDueHelper}
            checked={value.receivablesDue}
            onChange={(checked) => onChange({ ...value, receivablesDue: checked })}
          />

          <NotificationRow
            title={settingsContent.notifications.budgetAlerts}
            helper={settingsContent.notifications.budgetAlertsHelper}
            checked={value.budgetAlerts}
            onChange={(checked) => onChange({ ...value, budgetAlerts: checked })}
          >
            <label className="notification-inline-control">
              <span>{settingsContent.notifications.alertAt}</span>
              <select disabled={!value.budgetAlerts} value={value.budgetAlertPercent} onChange={(event) => onChange({ ...value, budgetAlertPercent: Number(event.target.value) })}>
                {[60, 70, 80, 90, 100].map((percent) => <option value={percent} key={percent}>{percent}%</option>)}
              </select>
            </label>
          </NotificationRow>

          <NotificationRow
            title={settingsContent.notifications.lowBalance}
            helper={settingsContent.notifications.lowBalanceHelper}
            checked={value.lowBalanceAlerts}
            onChange={(checked) => onChange({ ...value, lowBalanceAlerts: checked })}
          >
            <label className="notification-inline-control amount">
              <span>{settingsContent.notifications.lowBalanceAmount}</span>
              <input
                type="number"
                disabled={!value.lowBalanceAlerts}
                value={value.lowBalanceAmount}
                onChange={(event) => onChange({ ...value, lowBalanceAmount: Number(event.target.value) })}
              />
              <small>{formatCurrency(value.lowBalanceAmount)}</small>
            </label>
          </NotificationRow>
        </div>

        <div className="notification-secondary-grid">
          <article className="notification-group-card">
            <header><h3>{settingsContent.notifications.reportsTitle}</h3></header>
            <CompactToggle label={settingsContent.notifications.weeklySummary} helper={settingsContent.notifications.weeklySummaryHelper} checked={value.weeklySummary} onChange={(checked) => onChange({ ...value, weeklySummary: checked })} />
            <CompactToggle label={settingsContent.notifications.monthlySummary} helper={settingsContent.notifications.monthlySummaryHelper} checked={value.monthlySummary} onChange={(checked) => onChange({ ...value, monthlySummary: checked })} />
            <CompactToggle label={settingsContent.notifications.securityAlerts} helper={settingsContent.notifications.securityAlertsHelper} checked={value.securityAlerts} onChange={(checked) => onChange({ ...value, securityAlerts: checked })} />
          </article>

          <article className="notification-group-card">
            <header><h3>{settingsContent.notifications.channelsTitle}</h3></header>
            <label className="notification-channel-row"><span><MailIcon /><strong>{settingsContent.notifications.email}</strong></span><input type="checkbox" checked={value.emailChannel} onChange={(event) => onChange({ ...value, emailChannel: event.target.checked })} /><i /></label>
            <label className="notification-channel-row"><span><MonitorIcon /><strong>{settingsContent.notifications.browser}</strong></span><input type="checkbox" checked={value.browserChannel} onChange={(event) => onChange({ ...value, browserChannel: event.target.checked })} /><i /></label>
          </article>
        </div>
      </div>
    </section>
  );
}

function NotificationRow({ title, helper, checked, onChange, children }: { title: string; helper: string; checked: boolean; onChange: (checked: boolean) => void; children?: React.ReactNode }) {
  return (
    <article className="notification-setting-row">
      <label className="settings-toggle-row compact">
        <span><strong>{title}</strong><small>{helper}</small></span>
        <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
        <i aria-hidden="true" />
      </label>
      {children}
    </article>
  );
}

function CompactToggle({ label, helper, checked, onChange }: { label: string; helper: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return <label className="settings-toggle-row compact"><span><strong>{label}</strong><small>{helper}</small></span><input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} /><i /></label>;
}
