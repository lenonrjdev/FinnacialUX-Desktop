"use client";

import Link from "next/link";
import { useState } from "react";
import { LockIcon, MailIcon, UserIcon } from "@/components/shared/icons";
import { useAuth } from "@/components/providers/auth-provider";
import { authContent } from "@/content/acessos";
import { integrationContent } from "@/content/integracao";
import { isValidEmail } from "@/lib/access-control";
import type { RegisterInput } from "@/types/acessos";

const initialForm: RegisterInput = {
  name: "",
  email: "",
  password: "",
  passwordConfirmation: "",
  acceptedTerms: false,
};

export function RegisterForm() {
  const { register } = useAuth();
  const [form, setForm] = useState<RegisterInput>(initialForm);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  function update<K extends keyof RegisterInput>(key: K, value: RegisterInput[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form.name.trim() || !isValidEmail(form.email) || form.password.length < 8 || !form.acceptedTerms) {
      setError(authContent.register.invalid);
      return;
    }
    if (form.password !== form.passwordConfirmation) {
      setError(authContent.register.passwordMismatch);
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      await register(form.name, form.email, form.password);
      window.location.assign("/visao-geral");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : authContent.register.invalid);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="auth-card auth-card-register">
      <header className="auth-card-heading">
        <span>{authContent.register.eyebrow}</span>
        <h2>{authContent.register.title}</h2>
        <p>{authContent.register.description}</p>
      </header>

      <form className="auth-form" onSubmit={handleSubmit}>
        <label>
          <span>{authContent.register.name}</span>
          <div className="auth-input-wrap">
            <UserIcon />
            <input
              value={form.name}
              placeholder={authContent.register.namePlaceholder}
              onChange={(event) => update("name", event.target.value)}
              autoComplete="name"
            />
          </div>
        </label>

        <label>
          <span>{authContent.register.email}</span>
          <div className="auth-input-wrap">
            <MailIcon />
            <input
              type="email"
              value={form.email}
              placeholder={authContent.register.emailPlaceholder}
              onChange={(event) => update("email", event.target.value)}
              autoComplete="email"
            />
          </div>
        </label>

        <div className="auth-form-columns">
          <label>
            <span>{authContent.register.password}</span>
            <div className="auth-input-wrap">
              <LockIcon />
              <input
                type="password"
                value={form.password}
                placeholder={authContent.register.passwordPlaceholder}
                onChange={(event) => update("password", event.target.value)}
                autoComplete="new-password"
              />
            </div>
          </label>
          <label>
            <span>{authContent.register.confirmation}</span>
            <div className="auth-input-wrap">
              <LockIcon />
              <input
                type="password"
                value={form.passwordConfirmation}
                placeholder={authContent.register.confirmationPlaceholder}
                onChange={(event) => update("passwordConfirmation", event.target.value)}
                autoComplete="new-password"
              />
            </div>
          </label>
        </div>

        <label className="auth-checkbox auth-terms-checkbox">
          <input
            type="checkbox"
            checked={form.acceptedTerms}
            onChange={(event) => update("acceptedTerms", event.target.checked)}
          />
          <span>
            {authContent.register.termsPrefix} <b>{authContent.register.terms}</b> {authContent.register.privacyConnector} <b>{authContent.register.privacy}</b>.
          </span>
        </label>

        {error ? <p className="auth-form-error">{error}</p> : null}

        <button className="auth-submit-button" type="submit" disabled={submitting}>
          {submitting ? integrationContent.register.submitting : authContent.register.submit}
        </button>
      </form>

      <p className="auth-switch-copy">
        {authContent.register.hasAccount} <Link href="/login">{authContent.register.login}</Link>
      </p>
    </div>
  );
}
