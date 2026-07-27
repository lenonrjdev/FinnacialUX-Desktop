"use client";

import { useEffect, useRef, useState } from "react";
import { KeyIcon, LockIcon, LogOutIcon, ShieldIcon } from "@/components/shared/icons";

export function DesktopLockScreen({
  userName,
  pinEnabled,
  reason,
  busy,
  error,
  lockedUntil,
  onUnlock,
  onLogout,
}: {
  userName: string;
  pinEnabled: boolean;
  reason: string;
  busy: boolean;
  error: string;
  lockedUntil: string | null;
  onUnlock: (credential: string, method: "pin" | "password") => Promise<void>;
  onLogout: () => Promise<void>;
}) {
  const [method, setMethod] = useState<"pin" | "password">(pinEnabled ? "pin" : "password");
  const [credential, setCredential] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, [method]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!credential.trim()) return;
    await onUnlock(credential, method);
    setCredential("");
  }

  const lockedMessage = lockedUntil && new Date(lockedUntil).getTime() > Date.now()
    ? `Novas tentativas serão liberadas às ${new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" }).format(new Date(lockedUntil))}.`
    : "";

  return (
    <div className="desktop-lock-overlay" role="dialog" aria-modal="true" aria-labelledby="desktop-lock-title">
      <section className="desktop-lock-card">
        <span className="desktop-lock-brand"><ShieldIcon /></span>
        <div className="desktop-lock-copy">
          <span className="section-eyebrow">Sessão protegida</span>
          <h1 id="desktop-lock-title">FinnacialUX bloqueado</h1>
          <p>{userName}, a dashboard foi bloqueada por {reason}. Seus dados continuam salvos localmente.</p>
        </div>

        <div className="desktop-lock-methods" role="tablist" aria-label="Forma de desbloqueio">
          {pinEnabled ? (
            <button type="button" className={method === "pin" ? "active" : ""} onClick={() => setMethod("pin")}>
              <KeyIcon /> PIN
            </button>
          ) : null}
          <button type="button" className={method === "password" ? "active" : ""} onClick={() => setMethod("password")}>
            <LockIcon /> Senha
          </button>
        </div>

        <form onSubmit={submit} className="desktop-lock-form">
          <label>
            <span>{method === "pin" ? "PIN local" : "Senha da conta"}</span>
            <input
              ref={inputRef}
              type="password"
              inputMode={method === "pin" ? "numeric" : "text"}
              autoComplete="off"
              maxLength={method === "pin" ? 8 : 128}
              value={credential}
              onChange={(event) => {
                const next = method === "pin" ? event.target.value.replace(/\D/g, "") : event.target.value;
                setCredential(next);
              }}
              placeholder={method === "pin" ? "Digite de 4 a 8 números" : "Digite sua senha"}
              disabled={busy || Boolean(lockedMessage && method === "pin")}
            />
          </label>
          {error ? <div className="desktop-lock-error">{error}</div> : null}
          {lockedMessage && method === "pin" ? <div className="desktop-lock-warning">{lockedMessage}</div> : null}
          <button type="submit" className="primary-action-button" disabled={busy || !credential || Boolean(lockedMessage && method === "pin")}>
            <LockIcon /> {busy ? "Verificando..." : "Desbloquear"}
          </button>
        </form>

        <button type="button" className="desktop-lock-logout" disabled={busy} onClick={() => void onLogout()}>
          <LogOutIcon /> Sair desta conta
        </button>
      </section>
    </div>
  );
}
