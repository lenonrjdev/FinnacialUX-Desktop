"use client";

import Link from "next/link";
import { useState } from "react";
import { LogOutIcon, SettingsIcon, ShieldIcon, UsersIcon } from "@/components/shared/icons";
import { useAuth } from "@/components/providers/auth-provider";
import { dashboardContent } from "@/content/dashboard";
import { integrationContent } from "@/content/integracao";
import type { SessionUser } from "@/types/acessos";

export function UserMenu({ user }: { user: SessionUser }) {
  const { logout } = useAuth();
  const [open, setOpen] = useState(false);
  const [leaving, setLeaving] = useState(false);

  async function handleLogout() {
    setLeaving(true);
    await logout();
  }

  return (
    <div className="dashboard-user-menu">
      <button
        className="dashboard-user-trigger"
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-label={dashboardContent.accessibility.accountMenu}
        aria-expanded={open}
      >
        <span>{user.initials}</span>
      </button>
      {open ? (
        <div className="dashboard-user-dropdown">
          <header>
            <span>{user.initials}</span>
            <div><strong>{user.name}</strong><small>{user.email}</small></div>
          </header>
          <div className="dashboard-user-demo"><ShieldIcon /> {integrationContent.accountMenu.protectedSession}</div>
          <nav>
            <Link href="/acessos" onClick={() => setOpen(false)}><UsersIcon /> {dashboardContent.accountMenu.manageAccess}</Link>
            <Link href="/configuracoes" onClick={() => setOpen(false)}><SettingsIcon /> {dashboardContent.accountMenu.settings}</Link>
            <button type="button" onClick={handleLogout} disabled={leaving}><LogOutIcon /> {leaving ? integrationContent.accountMenu.leaving : dashboardContent.accountMenu.logout}</button>
          </nav>
        </div>
      ) : null}
    </div>
  );
}
