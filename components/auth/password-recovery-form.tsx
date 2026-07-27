"use client";

import Link from "next/link";
import { useState } from "react";
import { CheckIcon, MailIcon } from "@/components/shared/icons";
import { authContent } from "@/content/acessos";
import { integrationContent } from "@/content/integracao";
import { authApi } from "@/lib/api/auth";
import { isValidEmail } from "@/lib/access-control";

export function PasswordRecoveryForm() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const [resetToken, setResetToken] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!isValidEmail(email)) {
      setError(authContent.recovery.invalid);
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const result = await authApi.forgotPassword(email);
      setResetToken(result.resetToken ?? "");
      setSent(true);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : authContent.recovery.invalid);
    } finally {
      setSubmitting(false);
    }
  }

  if (sent) {
    return (
      <div className="auth-card auth-success-card">
        <span className="auth-success-icon"><CheckIcon /></span>
        <header className="auth-card-heading">
          <h2>{authContent.recovery.successTitle}</h2>
          <p>{authContent.recovery.successDescription}</p>
        </header>
        {resetToken ? (
          <div className="local-reset-token">
            <small>{integrationContent.localRecoveryToken}</small>
            <code>{resetToken}</code>
            <Link className="auth-submit-button" href={`/redefinir-senha?token=${encodeURIComponent(resetToken)}`}>
              {integrationContent.recovery.resetNow}
            </Link>
          </div>
        ) : null}
        <button className="auth-submit-button secondary" type="button" onClick={() => setSent(false)}>
          {authContent.recovery.sendAgain}
        </button>
        <Link className="auth-back-link" href="/login">{authContent.recovery.back}</Link>
      </div>
    );
  }

  return (
    <div className="auth-card">
      <header className="auth-card-heading">
        <span>{authContent.recovery.eyebrow}</span>
        <h2>{authContent.recovery.title}</h2>
        <p>{authContent.recovery.description}</p>
      </header>

      <form className="auth-form" onSubmit={handleSubmit}>
        <label>
          <span>{authContent.recovery.email}</span>
          <div className="auth-input-wrap">
            <MailIcon />
            <input
              type="email"
              value={email}
              placeholder={authContent.recovery.emailPlaceholder}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
            />
          </div>
        </label>
        {error ? <p className="auth-form-error">{error}</p> : null}
        <button className="auth-submit-button" type="submit" disabled={submitting}>
          {submitting ? integrationContent.recovery.preparing : authContent.recovery.submit}
        </button>
      </form>
      <Link className="auth-back-link" href="/login">{authContent.recovery.back}</Link>
    </div>
  );
}
