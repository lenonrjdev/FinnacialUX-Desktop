"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { CheckIcon, LockIcon } from "@/components/shared/icons";
import { integrationContent } from "@/content/integracao";
import { authApi } from "@/lib/api/auth";

export function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const [token, setToken] = useState(searchParams.get("token") ?? "");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (token.length < 32 || password.length < 8) {
      setError(integrationContent.resetPassword.validation);
      return;
    }
    if (password !== confirmation) {
      setError(integrationContent.resetPassword.mismatch);
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      await authApi.resetPassword(token, password);
      setDone(true);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : integrationContent.resetPassword.failure);
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <div className="auth-card auth-success-card">
        <span className="auth-success-icon"><CheckIcon /></span>
        <header className="auth-card-heading"><h2>{integrationContent.resetPassword.successTitle}</h2><p>{integrationContent.resetPassword.successDescription}</p></header>
        <Link className="auth-submit-button" href="/login">{integrationContent.resetPassword.successAction}</Link>
      </div>
    );
  }

  return (
    <div className="auth-card">
      <header className="auth-card-heading"><span>{integrationContent.resetPassword.eyebrow}</span><h2>{integrationContent.resetPassword.title}</h2><p>{integrationContent.resetPassword.description}</p></header>
      <form className="auth-form" onSubmit={submit}>
        <label><span>{integrationContent.resetPassword.token}</span><div className="auth-input-wrap"><LockIcon /><input value={token} onChange={(event) => setToken(event.target.value)} /></div></label>
        <label><span>{integrationContent.resetPassword.password}</span><div className="auth-input-wrap"><LockIcon /><input type="password" value={password} onChange={(event) => setPassword(event.target.value)} /></div></label>
        <label><span>{integrationContent.resetPassword.confirmation}</span><div className="auth-input-wrap"><LockIcon /><input type="password" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} /></div></label>
        {error ? <p className="auth-form-error">{error}</p> : null}
        <button className="auth-submit-button" type="submit" disabled={submitting}>{submitting ? integrationContent.resetPassword.submitting : integrationContent.resetPassword.submit}</button>
      </form>
      <Link className="auth-back-link" href="/login">{integrationContent.resetPassword.back}</Link>
    </div>
  );
}
