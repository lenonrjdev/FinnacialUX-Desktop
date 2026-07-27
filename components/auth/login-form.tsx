"use client";

import Link from "next/link";
import { useState } from "react";
import { LockIcon, MailIcon } from "@/components/shared/icons";
import { useAuth } from "@/components/providers/auth-provider";
import { authContent } from "@/content/acessos";
import { integrationContent } from "@/content/integracao";
import { isValidEmail } from "@/lib/access-control";

export function LoginForm() {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!isValidEmail(email) || password.length < 8) {
      setError(authContent.login.invalid);
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      await login(email, password, remember);
      window.location.assign("/visao-geral");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : authContent.login.invalid);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="auth-card">
      <header className="auth-card-heading">
        <span>{authContent.login.eyebrow}</span>
        <h2>{authContent.login.title}</h2>
        <p>{authContent.login.description}</p>
      </header>

      <form className="auth-form" onSubmit={handleSubmit}>
        <label>
          <span>{authContent.login.email}</span>
          <div className="auth-input-wrap">
            <MailIcon />
            <input
              type="email"
              value={email}
              placeholder={authContent.login.emailPlaceholder}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
            />
          </div>
        </label>

        <label>
          <span>{authContent.login.password}</span>
          <div className="auth-input-wrap">
            <LockIcon />
            <input
              type="password"
              value={password}
              placeholder={authContent.login.passwordPlaceholder}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
            />
          </div>
        </label>

        <div className="auth-form-options">
          <label className="auth-checkbox">
            <input
              type="checkbox"
              checked={remember}
              onChange={(event) => setRemember(event.target.checked)}
            />
            <span>{authContent.login.remember}</span>
          </label>
          <Link href="/recuperar-senha">{authContent.login.forgot}</Link>
        </div>

        {error ? <p className="auth-form-error">{error}</p> : null}

        <button className="auth-submit-button" type="submit" disabled={submitting}>
          {submitting ? integrationContent.login.submitting : authContent.login.submit}
        </button>
      </form>

      <p className="auth-switch-copy">
        {authContent.login.noAccount} <Link href="/registro">{authContent.login.register}</Link>
      </p>
      <small className="auth-demo-note">{integrationContent.login.backendNote}</small>
    </div>
  );
}
