"use client";

import { useState } from "react";
import { CloseIcon } from "@/components/shared/icons";
import { accessContent } from "@/content/acessos";
import type { CreateWorkspaceInput } from "@/types/acessos";

export function WorkspaceDialog({
  onClose,
  onSubmit,
}: {
  onClose: () => void;
  onSubmit: (input: CreateWorkspaceInput) => void;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState("");

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!name.trim()) {
      setError(accessContent.workspaceDialog.required);
      return;
    }
    onSubmit({ name: name.trim(), description: description.trim() });
  }

  return (
    <div className="transaction-dialog-backdrop" role="presentation" onMouseDown={onClose}>
      <section className="transaction-dialog access-dialog compact" role="dialog" aria-modal="true" aria-labelledby="workspace-dialog-title" onMouseDown={(event) => event.stopPropagation()}>
        <header className="transaction-dialog-header">
          <div>
            <span className="section-eyebrow">{accessContent.heading.eyebrow}</span>
            <h2 id="workspace-dialog-title">{accessContent.workspaceDialog.title}</h2>
            <p>{accessContent.workspaceDialog.description}</p>
          </div>
          <button className="dialog-close-button" type="button" onClick={onClose} aria-label={accessContent.accessibility.closeDialog}><CloseIcon /></button>
        </header>
        <form className="transaction-form" onSubmit={submit}>
          <label className="form-field">
            <span>{accessContent.workspaceDialog.name}</span>
            <input value={name} onChange={(event) => setName(event.target.value)} placeholder={accessContent.workspaceDialog.namePlaceholder} autoFocus />
          </label>
          <label className="form-field">
            <span>{accessContent.workspaceDialog.descriptionLabel}</span>
            <textarea value={description} onChange={(event) => setDescription(event.target.value)} placeholder={accessContent.workspaceDialog.descriptionPlaceholder} />
          </label>
          {error ? <p className="form-error-message">{error}</p> : null}
          <footer className="transaction-dialog-footer">
            <button type="button" className="secondary-action-button" onClick={onClose}>{accessContent.workspaceDialog.cancel}</button>
            <button type="submit" className="primary-action-button">{accessContent.workspaceDialog.submit}</button>
          </footer>
        </form>
      </section>
    </div>
  );
}
