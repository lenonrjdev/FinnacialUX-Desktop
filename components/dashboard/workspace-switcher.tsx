"use client";

import { useState } from "react";
import { CheckIcon, ChevronRightIcon, WorkspaceIcon } from "@/components/shared/icons";
import { accessContent } from "@/content/acessos";
import { dashboardContent } from "@/content/dashboard";
import type { FinancialWorkspace } from "@/types/acessos";

export function WorkspaceSwitcher({
  workspaces,
  selectedWorkspaceId,
  onChange,
}: {
  workspaces: FinancialWorkspace[];
  selectedWorkspaceId: string;
  onChange: (workspaceId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const selected = workspaces.find((workspace) => workspace.id === selectedWorkspaceId) ?? workspaces[0];

  return (
    <div className="workspace-switcher">
      <button
        className="workspace-switcher-trigger"
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-label={dashboardContent.accessibility.workspaceMenu}
        aria-expanded={open}
      >
        <span className="workspace-switcher-icon"><WorkspaceIcon /></span>
        <span className="workspace-switcher-copy">
          <small>{dashboardContent.topbar.workspaceLabel}</small>
          <strong>{selected.name}</strong>
        </span>
        <ChevronRightIcon className={open ? "open" : ""} />
      </button>

      {open ? (
        <div className="workspace-switcher-menu">
          {workspaces.map((workspace) => {
            const active = workspace.id === selectedWorkspaceId;
            return (
              <button
                className={active ? "active" : ""}
                type="button"
                key={workspace.id}
                onClick={() => {
                  onChange(workspace.id);
                  setOpen(false);
                }}
              >
                <span className="workspace-switcher-menu-icon"><WorkspaceIcon /></span>
                <span>
                  <strong>{workspace.name}</strong>
                  <small>{accessContent.roles[workspace.role]}</small>
                </span>
                {active ? <CheckIcon /> : null}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
