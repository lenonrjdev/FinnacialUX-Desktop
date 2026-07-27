"use client";

import { useEffect, useRef, useState } from "react";
import { LockIcon, ShieldIcon } from "@/components/shared/icons";
import type { SensitiveAction } from "@/types/desktop-security";

const actionCopy: Record<SensitiveAction, { title: string; description: string }> = {
  export: {
    title: "Confirmar exportação",
    description: "Esta operação cria um arquivo fora da pasta privada do FinnacialUX.",
  },
  restore: {
    title: "Confirmar restauração",
    description: "Esta operação pode substituir todos os dados locais atuais.",
  },
  security: {
    title: "Confirmar alteração de segurança",
    description: "Digite sua senha para confirmar esta mudança sensível.",
  },
};

export function SensitiveActionDialog({
  action,
  busy,
  error,
  onConfirm,
  onCancel,
}: {
  action: SensitiveAction;
  busy: boolean;
  error: string;
  onConfirm: (password: string) => Promise<void>;
  onCancel: () => void;
}) {
  const [password, setPassword] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const copy = actionCopy[action];

  useEffect(() => inputRef.current?.focus(), []);

  return (
    <div className="sensitive-action-overlay" role="dialog" aria-modal="true" aria-labelledby="sensitive-action-title">
      <form
        className="sensitive-action-card"
        onSubmit={(event) => {
          event.preventDefault();
          if (password) void onConfirm(password);
        }}
      >
        <span className="sensitive-action-icon"><ShieldIcon /></span>
        <div>
          <span className="section-eyebrow">Proteção local</span>
          <h2 id="sensitive-action-title">{copy.title}</h2>
          <p>{copy.description}</p>
        </div>
        <label className="form-field">
          <span>Senha atual</span>
          <input ref={inputRef} type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} disabled={busy} />
        </label>
        {error ? <div className="sensitive-action-error">{error}</div> : null}
        <div className="sensitive-action-actions">
          <button type="button" className="secondary-action-button" onClick={onCancel} disabled={busy}>Cancelar</button>
          <button type="submit" className="primary-action-button" disabled={busy || !password}><LockIcon /> {busy ? "Verificando..." : "Confirmar"}</button>
        </div>
      </form>
    </div>
  );
}
