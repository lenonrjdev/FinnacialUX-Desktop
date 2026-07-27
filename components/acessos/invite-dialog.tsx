"use client";

import { useState } from "react";
import { CloseIcon, EyeIcon, UserPlusIcon } from "@/components/shared/icons";
import { accessContent } from "@/content/acessos";
import { isValidEmail } from "@/lib/access-control";
import type { FinancialWorkspace, InviteMemberInput, WorkspaceRole } from "@/types/acessos";

export function InviteDialog({
  workspace,
  unavailableEmails,
  onClose,
  onSubmit,
}: {
  workspace: FinancialWorkspace;
  unavailableEmails: string[];
  onClose: () => void;
  onSubmit: (input: InviteMemberInput) => void;
}) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Exclude<WorkspaceRole, "owner">>("editor");
  const [error, setError] = useState("");

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedEmail = email.trim().toLowerCase();
    if (!isValidEmail(normalizedEmail)) {
      setError(accessContent.inviteDialog.invalidEmail);
      return;
    }
    if (unavailableEmails.includes(normalizedEmail)) {
      setError(accessContent.inviteDialog.duplicateEmail);
      return;
    }
    onSubmit({ email: normalizedEmail, role });
  }

  return (
    <div className="transaction-dialog-backdrop" role="presentation" onMouseDown={onClose}>
      <section className="transaction-dialog access-dialog" role="dialog" aria-modal="true" aria-labelledby="invite-dialog-title" onMouseDown={(event) => event.stopPropagation()}>
        <header className="transaction-dialog-header">
          <div>
            <span className="section-eyebrow">{accessContent.heading.eyebrow}</span>
            <h2 id="invite-dialog-title">{accessContent.inviteDialog.title}</h2>
            <p>{accessContent.inviteDialog.description}</p>
          </div>
          <button className="dialog-close-button" type="button" onClick={onClose} aria-label={accessContent.accessibility.closeDialog}><CloseIcon /></button>
        </header>
        <form className="transaction-form" onSubmit={submit}>
          <div className="access-dialog-workspace">
            <span><UserPlusIcon /></span>
            <div>
              <small>{accessContent.inviteDialog.workspace}</small>
              <strong>{workspace.name}</strong>
            </div>
          </div>
          <label className="form-field">
            <span>{accessContent.inviteDialog.email}</span>
            <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder={accessContent.inviteDialog.emailPlaceholder} autoFocus />
          </label>
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
          {error ? <p className="form-error-message">{error}</p> : null}
          <footer className="transaction-dialog-footer">
            <button type="button" className="secondary-action-button" onClick={onClose}>{accessContent.inviteDialog.cancel}</button>
            <button type="submit" className="primary-action-button">{accessContent.inviteDialog.submit}</button>
          </footer>
        </form>
      </section>
    </div>
  );
}
