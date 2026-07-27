"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { Brand } from "@/components/dashboard/brand";
import { DashboardLoadingSkeleton } from "@/components/dashboard/dashboard-loading-skeleton";
import { NavigationIcon } from "@/components/dashboard/navigation-icon";
import { UserMenu } from "@/components/dashboard/user-menu";
import { WorkspaceSwitcher } from "@/components/dashboard/workspace-switcher";
import { useAuth } from "@/components/providers/auth-provider";
import { FinanceDataProvider } from "@/components/providers/finance-data-provider";
import { CheckIcon, MenuIcon, MoonIcon, PlusIcon, SunIcon } from "@/components/shared/icons";
import { accessContent } from "@/content/acessos";
import { dashboardContent, dashboardNavigation } from "@/content/dashboard";
import { integrationContent } from "@/content/integracao";
import { usersApi } from "@/lib/api/users";
import { initialFinancialPreferences } from "@/data/configuracoes";
import { dashboardData } from "@/data/dashboard";
import { createInitials, getStoredWorkspaceId, persistWorkspaceId } from "@/lib/access-control";
import {
  applyAppearance,
  getOppositeAppearance,
  getStoredAppearance,
  persistAppearance,
  persistFinancialPreferences,
} from "@/lib/settings";
import type { SessionUser } from "@/types/acessos";
import type { FinancialPreferences, ProfileSettings } from "@/types/configuracoes";

const DashboardShellBoundary = createContext(false);

export default function DashboardShell({ children }: { children: React.ReactNode }) {
  const isAlreadyInsideShell = useContext(DashboardShellBoundary);

  if (isAlreadyInsideShell) return <>{children}</>;

  return (
    <DashboardShellBoundary.Provider value>
      <DashboardShellFrame>{children}</DashboardShellFrame>
    </DashboardShellBoundary.Provider>
  );
}

function DashboardShellFrame({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, workspaces, loading, error, refreshSession } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState("");
  const [displayUser, setDisplayUser] = useState<SessionUser | null>(null);
  const [preferences, setPreferences] = useState<FinancialPreferences>(initialFinancialPreferences);
  const [resolvedAppearance, setResolvedAppearance] = useState<"light" | "dark">("light");
  const [appearanceSaving, setAppearanceSaving] = useState(false);
  const [showLoadingSkeleton, setShowLoadingSkeleton] = useState(false);
  const redirectingToLoginRef = useRef(false);
  const allNavigationItems = useMemo(() => dashboardNavigation.flatMap((group) => group.items), []);

  useEffect(() => {
    if (loading || user || redirectingToLoginRef.current) return;
    redirectingToLoginRef.current = true;
    window.location.replace("/login/");
  }, [loading, user]);

  useEffect(() => {
    const waitingForDashboard = loading || Boolean(user && workspaces.length && !selectedWorkspaceId);
    if (!waitingForDashboard) {
      setShowLoadingSkeleton(false);
      return;
    }

    const timer = window.setTimeout(() => setShowLoadingSkeleton(true), 160);
    return () => window.clearTimeout(timer);
  }, [loading, selectedWorkspaceId, user, workspaces.length]);

  useEffect(() => {
    if (!user) return;
    setDisplayUser({ id: user.id, name: user.name, email: user.email, initials: user.initials });
  }, [user]);

  useEffect(() => {
    if (!workspaces.length) return;
    const fallback = user?.preferences?.defaultWorkspaceId ?? workspaces[0].id;
    const storedId = getStoredWorkspaceId(fallback);
    const resolvedId = workspaces.some((workspace) => workspace.id === storedId) ? storedId : fallback;
    persistWorkspaceId(resolvedId);
    setSelectedWorkspaceId(resolvedId);
  }, [workspaces, user?.preferences?.defaultWorkspaceId]);

  useEffect(() => {
    if (preferences.appearance !== "system") return;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const handleSystemAppearanceChange = () => setResolvedAppearance(applyAppearance("system"));
    media.addEventListener("change", handleSystemAppearanceChange);
    return () => media.removeEventListener("change", handleSystemAppearanceChange);
  }, [preferences.appearance]);

  useEffect(() => {
    const serverAppearance = user?.preferences?.appearance ?? initialFinancialPreferences.appearance;
    const cachedAppearance = getStoredAppearance(serverAppearance);
    const serverPreferences: FinancialPreferences = {
      ...initialFinancialPreferences,
      appearance: cachedAppearance,
      hideBalancesOnOpen: user?.preferences?.hideBalancesOnOpen ?? initialFinancialPreferences.hideBalancesOnOpen,
      compactNumbers: user?.preferences?.compactLargeValues ?? initialFinancialPreferences.compactNumbers,
    };
    setPreferences(serverPreferences);
    setResolvedAppearance(persistAppearance(cachedAppearance));

    function handleProfileChange(event: Event) {
      const profile = (event as CustomEvent<ProfileSettings>).detail;
      if (!profile || !user) return;
      setDisplayUser({
        id: user.id,
        name: profile.name,
        email: profile.email,
        initials: createInitials(profile.name) || user.initials,
      });
    }

    function handlePreferencesChange(event: Event) {
      const next = (event as CustomEvent<FinancialPreferences>).detail;
      if (!next) return;
      setPreferences(next);
      setResolvedAppearance(applyAppearance(next.appearance));
    }

    function handleAppearanceChange(event: Event) {
      const detail = (event as CustomEvent<{ appearance: FinancialPreferences["appearance"]; resolved: "light" | "dark" }>).detail;
      if (!detail) return;
      setPreferences((current) => ({ ...current, appearance: detail.appearance }));
      setResolvedAppearance(detail.resolved);
    }

    window.addEventListener("finance-profile-change", handleProfileChange);
    window.addEventListener("finance-preferences-change", handlePreferencesChange);
    window.addEventListener("finance-appearance-change", handleAppearanceChange);
    return () => {
      window.removeEventListener("finance-profile-change", handleProfileChange);
      window.removeEventListener("finance-preferences-change", handlePreferencesChange);
      window.removeEventListener("finance-appearance-change", handleAppearanceChange);
    };
  }, [user]);

  if (loading) {
    return showLoadingSkeleton
      ? <DashboardLoadingSkeleton variant="shell" label={integrationContent.loading} />
      : <div className="theme-loading-guard" aria-hidden="true" />;
  }

  if (!user || !displayUser) return null;

  if (!workspaces.length) {
    return <div className="backend-loading-screen backend-error-screen">{error || integrationContent.workspaceLoadError}</div>;
  }

  if (!selectedWorkspaceId) {
    return showLoadingSkeleton
      ? <DashboardLoadingSkeleton variant="shell" label={integrationContent.loading} />
      : <div className="theme-loading-guard" aria-hidden="true" />;
  }

  const selectedWorkspace = workspaces.find((workspace) => workspace.id === selectedWorkspaceId) ?? workspaces[0];
  const isReadOnly = selectedWorkspace.role === "viewer";

  function toggleAppearance() {
    if (appearanceSaving) return;
    const nextAppearance = getOppositeAppearance();
    const nextPreferences = { ...preferences, appearance: nextAppearance };
    setPreferences(nextPreferences);
    setResolvedAppearance(nextAppearance);
    persistFinancialPreferences(nextPreferences);
    setAppearanceSaving(true);
    void usersApi.updatePreferences({ appearance: nextAppearance })
      .then(() => refreshSession())
      .catch(() => undefined)
      .finally(() => setAppearanceSaving(false));
  }

  function selectWorkspace(workspaceId: string) {
    setSelectedWorkspaceId(workspaceId);
    persistWorkspaceId(workspaceId);
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-top"><Brand /></div>
        <nav className="side-nav finance-side-nav" aria-label={dashboardContent.accessibility.desktopNavigation}>
          {dashboardNavigation.map((group) => (
            <div className="nav-group" key={group.label}>
              <span className="nav-group-label">{group.label}</span>
              <div className="nav-group-links">
                {group.items.map((item) => (
                  <Link key={item.href} href={item.href} className={`side-link ${pathname === item.href ? "active" : ""}`}>
                    <NavigationIcon name={item.icon} /><span>{item.label}</span>
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </nav>
        <div className="sidebar-account">
          <span className="account-avatar account-initials" aria-hidden="true">{displayUser.initials}</span>
          <span className="account-copy"><strong>{displayUser.name}</strong><small>{accessContent.roles[selectedWorkspace.role]}</small></span>
        </div>
      </aside>

      <div className="workspace">
        <header className="topbar finance-topbar phase-thirteen-topbar">
          <div className="topbar-workspace-group">
            <WorkspaceSwitcher workspaces={workspaces} selectedWorkspaceId={selectedWorkspace.id} onChange={selectWorkspace} />
            <div className="topbar-context period-context">
              <span className="context-dot" aria-hidden="true" />
              <div><span>{dashboardContent.topbar.context}</span><strong>{dashboardData.currentPeriod}</strong></div>
            </div>
          </div>
          <div className="top-actions">
            {isReadOnly ? (
              <span className="new-entry-button read-only-button">{dashboardContent.topbar.readOnly}</span>
            ) : (
              <Link className="new-entry-button" href="/lancamentos#novo-lancamento"><PlusIcon />{dashboardContent.topbar.newEntry}</Link>
            )}
            <button
              className="icon-button theme-toggle-button"
              type="button"
              aria-label={resolvedAppearance === "dark" ? "Ativar tema claro" : "Ativar tema escuro"}
              aria-pressed={resolvedAppearance === "dark"}
              title={resolvedAppearance === "dark" ? "Ativar tema claro" : "Ativar tema escuro"}
              onClick={toggleAppearance}
              data-appearance={preferences.appearance}
              data-resolved-theme={resolvedAppearance}
              disabled={appearanceSaving}
            >
              {resolvedAppearance === "dark" ? <SunIcon /> : <MoonIcon />}
              <span className="sr-only">{resolvedAppearance === "dark" ? "Tema escuro ativo" : "Tema claro ativo"}</span>
            </button>
            <UserMenu user={displayUser} />
          </div>
        </header>

        <header className="mobile-header phase-thirteen-mobile-header">
          <Brand />
          <div className="mobile-header-actions">
            {!isReadOnly ? <Link className="mobile-entry-button" href="/lancamentos#novo-lancamento"><PlusIcon /><span>{dashboardContent.topbar.mobileNewEntry}</span></Link> : null}
            <button
              className="icon-button theme-toggle-button"
              type="button"
              aria-label={resolvedAppearance === "dark" ? "Ativar tema claro" : "Ativar tema escuro"}
              aria-pressed={resolvedAppearance === "dark"}
              title={resolvedAppearance === "dark" ? "Ativar tema claro" : "Ativar tema escuro"}
              onClick={toggleAppearance}
              data-appearance={preferences.appearance}
              data-resolved-theme={resolvedAppearance}
              disabled={appearanceSaving}
            >
              {resolvedAppearance === "dark" ? <SunIcon /> : <MoonIcon />}
              <span className="sr-only">{resolvedAppearance === "dark" ? "Tema escuro ativo" : "Tema claro ativo"}</span>
            </button>
            <UserMenu user={displayUser} />
            <button className="icon-button" type="button" onClick={() => setMobileOpen((open) => !open)} aria-label={mobileOpen ? dashboardContent.accessibility.closeNavigation : dashboardContent.accessibility.openNavigation} aria-expanded={mobileOpen}><MenuIcon /></button>
          </div>
        </header>

        {mobileOpen ? (
          <nav className="mobile-menu finance-mobile-menu phase-thirteen-mobile-menu" aria-label={dashboardContent.accessibility.mobileNavigation}>
            <WorkspaceSwitcher workspaces={workspaces} selectedWorkspaceId={selectedWorkspace.id} onChange={selectWorkspace} />
            {allNavigationItems.map((item) => (
              <Link key={item.href} href={item.href} className={pathname === item.href ? "active" : ""} onClick={() => setMobileOpen(false)}>
                <NavigationIcon name={item.icon} /><span>{item.label}</span>
              </Link>
            ))}
          </nav>
        ) : null}

        <FinanceDataProvider workspaceId={selectedWorkspace.id} readOnly={isReadOnly}>
          <main className="page-content finance-page-content">{children}</main>
        </FinanceDataProvider>
        <footer className="footer finance-footer">
          <span>{dashboardContent.footer.copyright}</span>
          <div className="footer-checks">
            <span><CheckIcon /> {dashboardContent.footer.privacy}</span>
            <span><CheckIcon /> {integrationContent.footerDatabase}</span>
          </div>
        </footer>
      </div>
    </div>
  );
}
