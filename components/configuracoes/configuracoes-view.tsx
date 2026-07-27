"use client";

import { useEffect, useMemo, useState } from "react";
import { ActivityPanel } from "@/components/configuracoes/activity-panel";
import { BackupsPanel } from "@/components/configuracoes/backups-panel";
import { DiagnosticsPanel } from "@/components/configuracoes/diagnostics-panel";
import { NotificationsPanel } from "@/components/configuracoes/notifications-panel";
import { PreferencesPanel } from "@/components/configuracoes/preferences-panel";
import { ProfileSettingsPanel } from "@/components/configuracoes/profile-settings-panel";
import { SecurityPanel } from "@/components/configuracoes/security-panel";
import { SettingsHeading } from "@/components/configuracoes/settings-heading";
import { SettingsNavigation } from "@/components/configuracoes/settings-navigation";
import { SettingsSummary } from "@/components/configuracoes/settings-summary";
import { useAuth } from "@/components/providers/auth-provider";
import { useFinanceDataState } from "@/components/providers/finance-data-provider";
import { CheckIcon } from "@/components/shared/icons";
import { settingsContent } from "@/content/configuracoes";
import {
  initialActiveSessions,
  initialActivityLog,
  initialBackupSettings,
  initialBackupSnapshots,
  initialFinancialPreferences,
  initialNotificationSettings,
  initialProfileSettings,
  initialSecuritySettings,
} from "@/data/configuracoes";
import { initialAccounts } from "@/data/contas";
import { usersApi } from "@/lib/api/users";
import {
  chooseBackupDestination,
  chooseBackupSource,
  createManualBackup,
  getNativeBackupPreferences,
  listNativeBackups,
  openDesktopFolder,
  previewNativeBackup,
  removeNativeBackup,
  restoreNativeBackup,
  saveNativeBackupPreferences,
} from "@/lib/desktop/protection";
import {
  applyAppearance,
  getStoredAppearance,
  persistAppearance,
  persistFinancialPreferences,
} from "@/lib/settings";
import type { FinancialAccount } from "@/types/contas";
import type {
  ActiveSession,
  BackupSettings,
  BackupSnapshot,
  FinancialPreferences,
  NotificationSettings,
  SecuritySettings,
  SettingsView,
} from "@/types/configuracoes";
import type { BackupPreview, NativeBackupRecord } from "@/types/desktop-protection";

type WorkspaceSettingsDocument = {
  preferences: FinancialPreferences;
  notifications: NotificationSettings;
  security: SecuritySettings;
  backupSettings: BackupSettings;
};

const initialWorkspaceSettings: WorkspaceSettingsDocument = {
  preferences: initialFinancialPreferences,
  notifications: initialNotificationSettings,
  security: initialSecuritySettings,
  backupSettings: initialBackupSettings,
};

function toBackupSnapshot(record: NativeBackupRecord): BackupSnapshot {
  return {
    id: record.id,
    fileName: record.fileName,
    filePath: record.filePath,
    createdAt: record.createdAt,
    sizeBytes: record.sizeBytes,
    modulesCount: record.modulesCount,
    status: record.status,
    automatic: record.kind === "automatic",
    kind: record.kind,
    integrityStatus: record.integrityStatus,
    checksumSha256: record.checksumSha256,
    appVersion: record.appVersion,
    schemaVersion: record.schemaVersion,
    errorMessage: record.errorMessage,
  };
}

export default function ConfiguracoesView() {
  const { user, refreshSession } = useAuth();
  const [view, setView] = useState<SettingsView>("profile");
  const [profile, setProfile] = useState(initialProfileSettings);
  const [preferences, setPreferences] = useState(initialFinancialPreferences);
  const [notifications, setNotifications] = useState(initialNotificationSettings);
  const [security, setSecurity] = useState(initialSecuritySettings);
  const [backupSettings, setBackupSettings] = useState(initialBackupSettings);
  const [sessions, setSessions] = useState<ActiveSession[]>(initialActiveSessions);
  const [workspaceSettings, setWorkspaceSettings] = useFinanceDataState<WorkspaceSettingsDocument>(
    "workspace-settings",
    initialWorkspaceSettings,
  );
  const [snapshots, setSnapshots] = useState<BackupSnapshot[]>(initialBackupSnapshots);
  const [restorePreview, setRestorePreview] = useState<BackupPreview | null>(null);
  const [backupBusy, setBackupBusy] = useState(false);
  const [accounts] = useFinanceDataState<FinancialAccount[]>("accounts", initialAccounts);
  const [feedback, setFeedback] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setPreferences({
      ...workspaceSettings.preferences,
      appearance: getStoredAppearance(workspaceSettings.preferences.appearance),
    });
    setNotifications(workspaceSettings.notifications);
    setSecurity(workspaceSettings.security);
  }, [workspaceSettings]);

  useEffect(() => {
    let active = true;
    void Promise.all([getNativeBackupPreferences(), listNativeBackups()])
      .then(([stored, records]) => {
        if (!active) return;
        setBackupSettings({
          automaticEnabled: stored.automaticEnabled,
          frequency: stored.frequency,
          retentionCount: stored.retentionCount,
          includeAttachments: stored.includeAttachments,
          lastAutomaticAt: stored.lastAutomaticAt,
        });
        setSnapshots(records.map(toBackupSnapshot));
      })
      .catch(() => undefined);
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!user) return;
    setProfile({
      name: user.name,
      email: user.email,
      phone: user.phone ?? "",
      timeZone: user.timezone,
    });

    void usersApi.getPreferences()
      .then((stored) => {
        const appearance = getStoredAppearance(stored.appearance);
        setPreferences((current) => ({
          ...current,
          appearance,
          defaultAccountId: stored.defaultAccountId ?? current.defaultAccountId,
          hideBalancesOnOpen: stored.hideBalancesOnOpen,
          compactNumbers: stored.compactLargeValues,
        }));
        applyAppearance(appearance);
        setNotifications((current) => ({
          ...current,
          billsDue: stored.notifyUpcomingBills,
          billsDueDaysBefore: stored.billReminderDays,
          receivablesDue: stored.notifyExpectedIncome,
          budgetAlerts: stored.notifyBudgetAlerts,
          lowBalanceAlerts: stored.notifyLowBalance,
          lowBalanceAmount: stored.lowBalanceThreshold,
          weeklySummary: stored.notifyWeeklySummary,
          monthlySummary: stored.notifyMonthlyClosing,
          securityAlerts: stored.notifySecurityAlerts,
        }));
      })
      .catch(() => undefined);
  }, [user]);

  const protectedAccount = security.twoFactorEnabled && security.loginAlerts;
  const availableBackupsCount = snapshots.filter((snapshot) => snapshot.status === "available").length;
  const lastActivityAt = useMemo(
    () => [...initialActivityLog].sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))[0]?.occurredAt ?? new Date().toISOString(),
    [],
  );

  function showFeedback(message: string) {
    setFeedback(message);
    window.setTimeout(() => setFeedback(""), 4200);
  }

  async function refreshBackups() {
    const records = await listNativeBackups();
    setSnapshots(records.map(toBackupSnapshot));
  }

  function changePreferences(next: FinancialPreferences) {
    if (next.appearance !== preferences.appearance) {
      persistAppearance(next.appearance);
      void usersApi.updatePreferences({ appearance: next.appearance })
        .then(() => refreshSession())
        .catch(() => undefined);
    }
    setPreferences(next);
  }

  async function saveCurrentView() {
    setSaving(true);
    try {
      if (view === "profile") {
        await usersApi.updateProfile({
          name: profile.name,
          email: profile.email,
          phone: profile.phone,
          locale: preferences.locale,
          timezone: profile.timeZone,
        });
        await refreshSession();
        showFeedback(settingsContent.feedback.profileSaved);
      } else if (view === "preferences") {
        setWorkspaceSettings((current) => ({ ...current, preferences }));
        await usersApi.updatePreferences({
          appearance: preferences.appearance,
          hideBalancesOnOpen: preferences.hideBalancesOnOpen,
          compactLargeValues: preferences.compactNumbers,
        });
        persistFinancialPreferences(preferences);
        showFeedback(settingsContent.feedback.preferencesSaved);
      } else if (view === "notifications") {
        setWorkspaceSettings((current) => ({ ...current, notifications }));
        await usersApi.updatePreferences({
          notifyUpcomingBills: notifications.billsDue,
          billReminderDays: notifications.billsDueDaysBefore,
          notifyExpectedIncome: notifications.receivablesDue,
          notifyBudgetAlerts: notifications.budgetAlerts,
          notifyLowBalance: notifications.lowBalanceAlerts,
          lowBalanceThreshold: notifications.lowBalanceAmount,
          notifyWeeklySummary: notifications.weeklySummary,
          notifyMonthlyClosing: notifications.monthlySummary,
          notifySecurityAlerts: notifications.securityAlerts,
        });
        showFeedback(settingsContent.feedback.notificationsSaved);
      } else if (view === "security") {
        setWorkspaceSettings((current) => ({ ...current, security }));
        showFeedback(settingsContent.feedback.securitySaved);
      } else if (view === "backups") {
        const stored = await saveNativeBackupPreferences({
          automaticEnabled: backupSettings.automaticEnabled,
          frequency: backupSettings.frequency,
          retentionCount: backupSettings.retentionCount,
          includeAttachments: backupSettings.includeAttachments,
          lastAutomaticAt: backupSettings.lastAutomaticAt ?? null,
        });
        setBackupSettings({ ...backupSettings, lastAutomaticAt: stored.lastAutomaticAt });
        setWorkspaceSettings((current) => ({ ...current, backupSettings }));
        showFeedback(settingsContent.feedback.backupSettingsSaved);
      } else {
        showFeedback(settingsContent.heading.saved);
      }
    } catch (caught) {
      showFeedback(caught instanceof Error ? caught.message : "Não foi possível salvar as configurações.");
    } finally {
      setSaving(false);
    }
  }

  async function createBackup() {
    setBackupBusy(true);
    try {
      const destination = await chooseBackupDestination();
      if (!destination) return;
      await createManualBackup(destination);
      await refreshBackups();
      showFeedback("Backup nativo criado, verificado e salvo no local escolhido.");
    } catch (caught) {
      showFeedback(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setBackupBusy(false);
    }
  }

  async function removeBackup(snapshot: BackupSnapshot) {
    setBackupBusy(true);
    try {
      const deleteFile = snapshot.kind === "automatic" || snapshot.kind === "pre_restore";
      await removeNativeBackup(snapshot.id, deleteFile);
      await refreshBackups();
      showFeedback(deleteFile ? "Backup automático e registro removidos." : "Registro removido. O arquivo manual permanece no local escolhido.");
    } catch (caught) {
      showFeedback(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setBackupBusy(false);
    }
  }

  async function selectRestoreFile() {
    setBackupBusy(true);
    try {
      const source = await chooseBackupSource();
      if (!source) return;
      setRestorePreview(await previewNativeBackup(source));
    } catch (caught) {
      setRestorePreview(null);
      showFeedback(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setBackupBusy(false);
    }
  }

  async function previewSnapshot(snapshot: BackupSnapshot) {
    if (!snapshot.filePath) return;
    setBackupBusy(true);
    try {
      setRestorePreview(await previewNativeBackup(snapshot.filePath));
    } catch (caught) {
      setRestorePreview(null);
      showFeedback(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setBackupBusy(false);
    }
  }

  async function restoreBackup() {
    if (!restorePreview?.compatible) return;
    setBackupBusy(true);
    try {
      await restoreNativeBackup(restorePreview.filePath);
      window.location.replace("/login/");
    } catch (caught) {
      showFeedback(caught instanceof Error ? caught.message : String(caught));
      setBackupBusy(false);
    }
  }

  return (
    <div className="financial-management-page settings-page">
      <SettingsHeading onSave={() => void saveCurrentView()} saving={saving} />
      <SettingsSummary
        profileName={profile.name}
        profileEmail={profile.email}
        protectedAccount={protectedAccount}
        lastActivityAt={lastActivityAt}
        backupsCount={availableBackupsCount}
      />

      <SettingsNavigation value={view} onChange={setView} />

      {view === "profile" ? <ProfileSettingsPanel value={profile} onChange={setProfile} /> : null}
      {view === "preferences" ? <PreferencesPanel value={preferences} accounts={accounts} onChange={changePreferences} /> : null}
      {view === "notifications" ? <NotificationsPanel value={notifications} onChange={setNotifications} /> : null}
      {view === "security" ? <SecurityPanel value={security} sessions={sessions} onChange={setSecurity} onSessionsChange={setSessions} onFeedback={showFeedback} /> : null}
      {view === "activity" ? <ActivityPanel entries={initialActivityLog} /> : null}
      {view === "backups" ? (
        <BackupsPanel
          settings={backupSettings}
          snapshots={snapshots}
          restorePreview={restorePreview}
          busy={backupBusy}
          onSettingsChange={setBackupSettings}
          onCreate={createBackup}
          onRefresh={refreshBackups}
          onRemove={removeBackup}
          onSelectRestore={selectRestoreFile}
          onPreviewSnapshot={previewSnapshot}
          onRestore={restoreBackup}
          onOpenFolder={() => openDesktopFolder("backups").then(() => undefined)}
        />
      ) : null}
      {view === "diagnostics" ? <DiagnosticsPanel onFeedback={showFeedback} /> : null}

      {feedback ? <div className="transaction-feedback settings-feedback" role="status"><CheckIcon /> {feedback}</div> : null}
    </div>
  );
}
