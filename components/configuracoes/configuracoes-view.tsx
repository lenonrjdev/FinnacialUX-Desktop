"use client";

import { useEffect, useMemo, useState } from "react";
import { ActivityPanel } from "@/components/configuracoes/activity-panel";
import { BackupsPanel, type CreateBackupOptions } from "@/components/configuracoes/backups-panel";
import { DiagnosticsPanel } from "@/components/configuracoes/diagnostics-panel";
import { PerformancePanel } from "@/components/configuracoes/performance-panel";
import { BackgroundTasksPanel } from "@/components/configuracoes/background-tasks-panel";
import { ContinuityPanel } from "@/components/configuracoes/continuity-panel";
import { DesktopExperiencePanel } from "@/components/configuracoes/desktop-experience-panel";
import { AccessibilityPanel } from "@/components/configuracoes/accessibility-panel";
import { NotificationsPanel } from "@/components/configuracoes/notifications-panel";
import { OnboardingSettingsPanel } from "@/components/configuracoes/onboarding-settings-panel";
import { PreferencesPanel } from "@/components/configuracoes/preferences-panel";
import { ProfileSettingsPanel } from "@/components/configuracoes/profile-settings-panel";
import { SecurityPanel } from "@/components/configuracoes/security-panel";
import { UpdatesPanel } from "@/components/configuracoes/updates-panel";
import { ReleaseCandidatePanel } from "@/components/configuracoes/release-candidate-panel";
import { MaintenancePanel } from "@/components/configuracoes/maintenance-panel";
import { SettingsHeading } from "@/components/configuracoes/settings-heading";
import { SettingsNavigation } from "@/components/configuracoes/settings-navigation";
import { SettingsSummary } from "@/components/configuracoes/settings-summary";
import { useAuth } from "@/components/providers/auth-provider";
import { useDesktopSecurity } from "@/components/providers/desktop-security-provider";
import { useFinanceDataState } from "@/components/providers/finance-data-provider";
import { CheckIcon } from "@/components/shared/icons";
import { settingsContent } from "@/content/configuracoes";
import {
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
  inspectNativeBackup,
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
  ActivityLogEntry,
  BackupSettings,
  BackupSnapshot,
  FinancialPreferences,
  NotificationSettings,
  SecuritySettings,
  SettingsView,
} from "@/types/configuracoes";
import type { BackupHeader, BackupPreview, NativeBackupRecord } from "@/types/desktop-protection";
import { listSecurityEvents } from "@/lib/desktop/security";
import { getDatabaseEncryptionStatus, rotateDatabaseEncryptionKey } from "@/lib/desktop/database";
import type { LocalSecuritySettings, SecurityEventRecord } from "@/types/desktop-security";
import type { DatabaseEncryptionStatus } from "@/types/desktop-database";

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
    encryptionMode: record.encryptionMode,
    errorMessage: record.errorMessage,
  };
}


const securityEventTitles: Record<string, string> = {
  password_verified: "Senha local confirmada",
  password_rejected: "Tentativa de senha rejeitada",
  password_changed: "Senha local alterada",
  pin_enabled: "PIN local ativado",
  pin_disabled: "PIN local removido",
  pin_unlocked: "Aplicativo desbloqueado por PIN",
  pin_rejected: "Tentativa de PIN rejeitada",
  application_locked: "Aplicativo bloqueado",
  security_preferences_changed: "Preferências de segurança alteradas",
  database_encrypted: "Banco local criptografado",
  database_key_rotated: "Chave do banco rotacionada",
};

function toActivityEntry(event: SecurityEventRecord, actor: string): ActivityLogEntry {
  return {
    id: event.id,
    type: "security",
    title: securityEventTitles[event.eventType] ?? "Evento de segurança local",
    description: event.message,
    actor,
    occurredAt: event.createdAt,
    device: "Este computador",
    status: event.severity === "info" ? "success" : event.severity === "warning" ? "attention" : "blocked",
  };
}

function toSecuritySettings(stored: LocalSecuritySettings): SecuritySettings {
  return {
    pinEnabled: stored.pinEnabled,
    autoLockMinutes: stored.autoLockMinutes,
    lockOnMinimize: stored.lockOnMinimize,
    requirePasswordForExports: stored.requirePasswordForExports,
    requirePasswordForRestore: stored.requirePasswordForRestore,
    encryptedBackupsDefault: stored.encryptedBackupsDefault,
    vaultInitialized: stored.vaultInitialized,
  };
}

export default function ConfiguracoesView() {
  const { user, refreshSession } = useAuth();
  const desktopSecurity = useDesktopSecurity();
  const [view, setView] = useState<SettingsView>("profile");
  const [profile, setProfile] = useState(initialProfileSettings);
  const [preferences, setPreferences] = useState(initialFinancialPreferences);
  const [notifications, setNotifications] = useState(initialNotificationSettings);
  const [security, setSecurity] = useState(initialSecuritySettings);
  const [backupSettings, setBackupSettings] = useState(initialBackupSettings);
  const [workspaceSettings, setWorkspaceSettings] = useFinanceDataState<WorkspaceSettingsDocument>(
    "workspace-settings",
    initialWorkspaceSettings,
  );
  const [snapshots, setSnapshots] = useState<BackupSnapshot[]>(initialBackupSnapshots);
  const [restoreHeader, setRestoreHeader] = useState<BackupHeader | null>(null);
  const [restorePreview, setRestorePreview] = useState<BackupPreview | null>(null);
  const [backupBusy, setBackupBusy] = useState(false);
  const [securityBusy, setSecurityBusy] = useState(false);
  const [databaseSecurity, setDatabaseSecurity] = useState<DatabaseEncryptionStatus | null>(null);
  const [accounts] = useFinanceDataState<FinancialAccount[]>("accounts", initialAccounts);
  const [feedback, setFeedback] = useState("");
  const [activityEntries, setActivityEntries] = useState<ActivityLogEntry[]>(initialActivityLog);
  const [saving, setSaving] = useState(false);

  const changeSettingsView = (next: SettingsView) => {
    setView(next);
    const hashes: Partial<Record<SettingsView, string>> = {
      security: "seguranca",
      backups: "backups",
      continuity: "continuidade",
      diagnostics: "diagnostico",
      performance: "desempenho",
      background: "rotinas",
      desktop: "desktop",
      accessibility: "acessibilidade",
      onboarding: "primeiros-passos",
      updates: "atualizacoes",
      maintenance: "manutencao",
    };
    const hash = hashes[next];
    window.history.replaceState(null, "", hash ? `#${hash}` : window.location.pathname);
  };

  useEffect(() => {
    const syncViewFromHash = () => {
      const hash = window.location.hash;
      if (hash === "#manutencao") setView("maintenance");
      else if (hash === "#atualizacoes") setView("updates");
      else if (hash === "#desktop") setView("desktop");
      else if (hash === "#acessibilidade") setView("accessibility");
      else if (hash === "#primeiros-passos") setView("onboarding");
      else if (hash === "#continuidade") setView("continuity");
      else if (hash === "#diagnostico") setView("diagnostics");
      else if (hash === "#desempenho") setView("performance");
      else if (hash === "#rotinas") setView("background");
      else if (hash === "#seguranca") setView("security");
      else if (hash === "#backups") setView("backups");
    };
    syncViewFromHash();
    window.addEventListener("hashchange", syncViewFromHash);
    return () => window.removeEventListener("hashchange", syncViewFromHash);
  }, []);

  useEffect(() => {
    setPreferences({
      ...workspaceSettings.preferences,
      appearance: getStoredAppearance(workspaceSettings.preferences.appearance),
    });
    setNotifications(workspaceSettings.notifications);
  }, [workspaceSettings]);

  useEffect(() => {
    setSecurity(toSecuritySettings(desktopSecurity.settings));
  }, [desktopSecurity.settings]);

  useEffect(() => {
    let active = true;
    void getDatabaseEncryptionStatus()
      .then((status) => { if (active) setDatabaseSecurity(status); })
      .catch(() => { if (active) setDatabaseSecurity(null); });
    return () => { active = false; };
  }, []);

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
          encryptionMode: stored.encryptionMode,
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

    void listSecurityEvents(user.id, 100)
      .then((events) => setActivityEntries(events.map((event) => toActivityEntry(event, user.name))))
      .catch(() => setActivityEntries([]));

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

  const protectedAccount = desktopSecurity.vaultReady
    && (security.pinEnabled || security.requirePasswordForRestore || security.encryptedBackupsDefault);
  const availableBackupsCount = snapshots.filter((snapshot) => snapshot.status === "available").length;
  const lastActivityAt = useMemo(
    () => [...activityEntries].sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))[0]?.occurredAt ?? new Date().toISOString(),
    [activityEntries],
  );

  function showFeedback(message: string) {
    setFeedback(message);
    window.setTimeout(() => setFeedback(""), 5200);
  }

  async function refreshBackups() {
    const records = await listNativeBackups();
    setSnapshots(records.map(toBackupSnapshot));
  }

  async function refreshActivity() {
    if (!user) return;
    const events = await listSecurityEvents(user.id, 100);
    setActivityEntries(events.map((event) => toActivityEntry(event, user.name)));
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
        const stored = await desktopSecurity.updateSettings({
          ...desktopSecurity.settings,
          autoLockMinutes: security.autoLockMinutes,
          lockOnMinimize: security.lockOnMinimize,
          requirePasswordForExports: security.requirePasswordForExports,
          requirePasswordForRestore: security.requirePasswordForRestore,
          encryptedBackupsDefault: security.encryptedBackupsDefault,
        });
        const next = toSecuritySettings(stored);
        const defaultEncryptionMode = stored.encryptedBackupsDefault ? "device" : "none";
        const storedBackupSettings = await saveNativeBackupPreferences({
          automaticEnabled: backupSettings.automaticEnabled,
          frequency: backupSettings.frequency,
          retentionCount: backupSettings.retentionCount,
          includeAttachments: backupSettings.includeAttachments,
          encryptionMode: defaultEncryptionMode,
          lastAutomaticAt: backupSettings.lastAutomaticAt ?? null,
        });
        setSecurity(next);
        setBackupSettings((current) => ({ ...current, encryptionMode: storedBackupSettings.encryptionMode }));
        setWorkspaceSettings((current) => ({
          ...current,
          security: next,
          backupSettings: { ...current.backupSettings, encryptionMode: storedBackupSettings.encryptionMode },
        }));
        showFeedback("Preferências de segurança local e proteção padrão dos backups salvas.");
      } else if (view === "backups") {
        const stored = await saveNativeBackupPreferences({
          automaticEnabled: backupSettings.automaticEnabled,
          frequency: backupSettings.frequency,
          retentionCount: backupSettings.retentionCount,
          includeAttachments: backupSettings.includeAttachments,
          encryptionMode: backupSettings.encryptionMode,
          lastAutomaticAt: backupSettings.lastAutomaticAt ?? null,
        });
        const next = { ...backupSettings, encryptionMode: stored.encryptionMode, lastAutomaticAt: stored.lastAutomaticAt };
        setBackupSettings(next);
        setWorkspaceSettings((current) => ({ ...current, backupSettings: next }));
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

  async function createBackup(options: CreateBackupOptions) {
    if (!(await desktopSecurity.confirmSensitiveAction("export"))) return;
    setBackupBusy(true);
    try {
      const destination = await chooseBackupDestination();
      if (!destination) return;
      const credential = options.mode === "device"
        ? await desktopSecurity.getDeviceBackupKey()
        : options.mode === "password"
          ? options.password
          : undefined;
      await createManualBackup(destination, options.mode, credential);
      await refreshBackups();
      showFeedback(options.mode === "none"
        ? "Backup criado sem criptografia. Guarde o arquivo em local seguro."
        : "Backup criptografado, verificado e salvo no local escolhido.");
    } catch (caught) {
      showFeedback(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setBackupBusy(false);
    }
  }

  async function removeBackup(snapshot: BackupSnapshot) {
    setBackupBusy(true);
    try {
      const deleteFile = snapshot.kind === "automatic" || snapshot.kind === "pre_restore" || snapshot.kind === "pre_update";
      await removeNativeBackup(snapshot.id, deleteFile);
      await refreshBackups();
      showFeedback(deleteFile ? "Arquivo protegido e registro de backup removidos." : "Registro removido. O arquivo manual permanece no local escolhido.");
    } catch (caught) {
      showFeedback(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setBackupBusy(false);
    }
  }

  async function resolveCredential(header: BackupHeader, password?: string): Promise<string | undefined> {
    if (header.manifest.encryptionMode === "device") return desktopSecurity.getDeviceBackupKey();
    if (header.manifest.encryptionMode === "password") {
      if (!password) throw new Error("Digite a senha usada para criptografar este backup.");
      return password;
    }
    return undefined;
  }

  async function prepareRestoreSource(source: string) {
    const header = await inspectNativeBackup(source);
    setRestoreHeader(header);
    setRestorePreview(null);
    if (header.manifest.encryptionMode !== "password") {
      const credential = await resolveCredential(header);
      setRestorePreview(await previewNativeBackup(source, credential));
    }
  }

  async function selectRestoreFile() {
    setBackupBusy(true);
    try {
      const source = await chooseBackupSource();
      if (!source) return;
      await prepareRestoreSource(source);
    } catch (caught) {
      setRestoreHeader(null);
      setRestorePreview(null);
      showFeedback(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setBackupBusy(false);
    }
  }

  async function unlockRestore(password: string) {
    if (!restoreHeader) return;
    setBackupBusy(true);
    try {
      const credential = await resolveCredential(restoreHeader, password);
      setRestorePreview(await previewNativeBackup(restoreHeader.filePath, credential));
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
      await prepareRestoreSource(snapshot.filePath);
    } catch (caught) {
      setRestoreHeader(null);
      setRestorePreview(null);
      showFeedback(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setBackupBusy(false);
    }
  }

  async function restoreBackup(password: string) {
    if (!restorePreview?.compatible || !restoreHeader) return;
    if (!(await desktopSecurity.confirmSensitiveAction("restore"))) return;
    setBackupBusy(true);
    try {
      const credential = await resolveCredential(restoreHeader, password);
      const safetyCredential = await desktopSecurity.getDeviceBackupKey();
      await restoreNativeBackup(restorePreview.filePath, credential, safetyCredential);
      window.location.replace("/login/");
    } catch (caught) {
      showFeedback(caught instanceof Error ? caught.message : String(caught));
      setBackupBusy(false);
    }
  }

  async function runSecurityAction(action: () => Promise<void>) {
    setSecurityBusy(true);
    try {
      await action();
      await refreshActivity().catch(() => undefined);
    } finally {
      setSecurityBusy(false);
    }
  }

  async function rotateDatabaseKey() {
    if (!(await desktopSecurity.confirmSensitiveAction("security"))) return;
    await runSecurityAction(async () => {
      const status = await rotateDatabaseEncryptionKey();
      setDatabaseSecurity(status);
      showFeedback("A chave do banco SQLCipher foi rotacionada e validada com sucesso.");
    });
  }

  return (
    <div className="financial-management-page settings-page">
      <SettingsHeading onSave={() => void saveCurrentView()} saving={saving} showSave={!(["updates", "maintenance", "diagnostics", "performance", "background", "continuity", "activity", "desktop", "accessibility", "onboarding"] as SettingsView[]).includes(view)} />
      <SettingsSummary
        profileName={profile.name}
        profileEmail={profile.email}
        protectedAccount={protectedAccount}
        lastActivityAt={lastActivityAt}
        backupsCount={availableBackupsCount}
      />

      <SettingsNavigation value={view} onChange={changeSettingsView} />

      {view === "profile" ? <ProfileSettingsPanel value={profile} onChange={setProfile} /> : null}
      {view === "preferences" ? <PreferencesPanel value={preferences} accounts={accounts} onChange={changePreferences} /> : null}
      {view === "notifications" ? <NotificationsPanel value={notifications} onChange={setNotifications} /> : null}
      {view === "security" ? (
        <SecurityPanel
          value={security}
          vaultReady={desktopSecurity.vaultReady}
          databaseSecurity={databaseSecurity}
          busy={securityBusy || desktopSecurity.loading}
          onChange={setSecurity}
          onChangePassword={(currentPassword, newPassword) => runSecurityAction(() => desktopSecurity.updatePassword(currentPassword, newPassword))}
          onEnablePin={(password, pin) => runSecurityAction(async () => {
            const stored = await desktopSecurity.enablePin(password, pin);
            setSecurity(toSecuritySettings(stored));
          })}
          onDisablePin={(password) => runSecurityAction(async () => {
            const stored = await desktopSecurity.disablePin(password);
            setSecurity(toSecuritySettings(stored));
          })}
          onLockNow={() => desktopSecurity.lock("solicitação manual")}
          onRotateDatabaseKey={rotateDatabaseKey}
          onFeedback={showFeedback}
        />
      ) : null}
      {view === "activity" ? <ActivityPanel entries={activityEntries} /> : null}
      {view === "backups" ? (
        <BackupsPanel
          settings={backupSettings}
          snapshots={snapshots}
          restoreHeader={restoreHeader}
          restorePreview={restorePreview}
          defaultMode={security.encryptedBackupsDefault ? "device" : "none"}
          busy={backupBusy}
          onSettingsChange={setBackupSettings}
          onCreate={createBackup}
          onRefresh={refreshBackups}
          onRemove={removeBackup}
          onSelectRestore={selectRestoreFile}
          onUnlockRestore={unlockRestore}
          onPreviewSnapshot={previewSnapshot}
          onRestore={restoreBackup}
          onOpenFolder={() => openDesktopFolder("backups").then(() => undefined)}
        />
      ) : null}
      {view === "continuity" ? <ContinuityPanel onFeedback={showFeedback} onConfirmRestore={() => desktopSecurity.confirmSensitiveAction("restore")} /> : null}
      {view === "diagnostics" ? <DiagnosticsPanel onFeedback={showFeedback} /> : null}
      {view === "performance" ? <PerformancePanel onFeedback={showFeedback} /> : null}
      {view === "background" ? <BackgroundTasksPanel onFeedback={showFeedback} /> : null}
      {view === "desktop" ? <DesktopExperiencePanel /> : null}
      {view === "accessibility" ? <AccessibilityPanel /> : null}
      {view === "onboarding" ? <OnboardingSettingsPanel /> : null}
      {view === "maintenance" ? <MaintenancePanel onFeedback={showFeedback} /> : null}
      {view === "updates" ? (
        <>
          <UpdatesPanel
            onConfirmInstall={() => desktopSecurity.confirmSensitiveAction("security")}
            getBackupCredential={desktopSecurity.getDeviceBackupKey}
            onFeedback={showFeedback}
          />
          <ReleaseCandidatePanel onFeedback={showFeedback} />
        </>
      ) : null}

      {feedback ? <div className="transaction-feedback settings-feedback" role="status"><CheckIcon /> {feedback}</div> : null}
    </div>
  );
}
