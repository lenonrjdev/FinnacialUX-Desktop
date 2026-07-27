"use client";

import { useState } from "react";
import { CloseIcon, EyeIcon, UserPlusIcon } from "@/components/shared/icons";
import { accessContent } from "@/content/acessos";
import type { WorkspaceMember, WorkspaceRole } from "@/types/acessos";

export function MemberRoleDialog({
  member,
  onClose,
  onSubmit,
}: {
  member: WorkspaceMember;
  onClose: () => void;
  onSubmit: (role: Exclude<WorkspaceRole, "owner">) => void;
}) {
  const [role, setRole] = useState<Exclude<WorkspaceRole, "owner">>(member.role === "viewer" ? "viewer" : "editor");

  return (
    <div className="transaction-dialog-backdrop" role="presentation" onMouseDown={onClose}>
      <section className="transaction-dialog access-dialog compact" role="dialog" aria-modal="true" aria-labelledby="role-dialog-title" onMouseDown={(event) => event.stopPropagation()}>
        <header className="transaction-dialog-header">
          <div>
            <span className="section-eyebrow">{member.name}</span>
            <h2 id="role-dialog-title">{accessContent.roleDialog.title}</h2>
            <p>{accessContent.roleDialog.description}</p>
          </div>
          <button className="dialog-close-button" type="button" onClick={onClose} aria-label={accessContent.accessibility.closeDialog}><CloseIcon /></button>
        </header>
        <div className="transaction-form">
          <fieldset className="access-role-selector">
            <legend>{accessContent.inviteDialog.role}</legend>
            <button className={role === "editor" ? "active" : ""} type="button" onClick={() => setRole("editor")}>
              <UserPlusIcon />
              <span><strong>{accessContent.roles.editor}</strong><small>{accessContent.inviteDialog.editorDescription}</small></span>
            </button>
            <button className={role === "viewer" ? "active" : ""} type="button" onClick={() => setRole("viewer")}>
              <EyeIcon />
              <span><strong>{accessContent.roles.viewer}</strong><small>{accessContent.inviteDialog.viewerDescription}</small></span>
            </button>
          </fieldset>
          <footer className="transaction-dialog-footer">
            <button type="button" className="secondary-action-button" onClick={onClose}>{accessContent.roleDialog.cancel}</button>
            <button type="button" className="primary-action-button" onClick={() => onSubmit(role)}>{accessContent.roleDialog.submit}</button>
          </footer>
        </div>
      </section>
    </div>
  );
}
