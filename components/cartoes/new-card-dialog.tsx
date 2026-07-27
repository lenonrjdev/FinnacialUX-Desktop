"use client";

import { FormEvent, useEffect, useState } from "react";
import { CloseIcon } from "@/components/shared/icons";
import { cardsContent } from "@/content/cartoes";
import type { FinancialAccount } from "@/types/contas";
import type { CardBrand, CardStyle, NewCardInput } from "@/types/cartoes";

const initialForm = {
  name: "",
  institution: "",
  lastFourDigits: "",
  brand: "mastercard" as CardBrand,
  style: "graphite" as CardStyle,
  limit: "",
  closingDay: "",
  dueDay: "",
  paymentAccountId: "",
};

export function NewCardDialog({
  open,
  accounts,
  existingCards,
  onClose,
  onCreate,
}: {
  open: boolean;
  accounts: FinancialAccount[];
  existingCards: Array<{ name: string; lastFourDigits: string }>;
  onClose: () => void;
  onCreate: (input: NewCardInput) => void;
}) {
  const [form, setForm] = useState(initialForm);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;

    setForm((current) => ({
      ...current,
      paymentAccountId: current.paymentAccountId || accounts[0]?.id || "",
    }));

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", closeOnEscape);

    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [accounts, onClose, open]);

  if (!open) return null;

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const limit = Number(form.limit.replace(",", "."));
    const closingDay = Number(form.closingDay);
    const dueDay = Number(form.dueDay);

    if (
      !form.name.trim() ||
      !form.institution.trim() ||
      !form.paymentAccountId ||
      !form.limit ||
      !form.closingDay ||
      !form.dueDay
    ) {
      setError(cardsContent.validation.required);
      return;
    }

    if (!/^\d{4}$/.test(form.lastFourDigits)) {
      setError(cardsContent.validation.validDigits);
      return;
    }

    if (!Number.isFinite(limit) || limit <= 0) {
      setError(cardsContent.validation.positiveAmount);
      return;
    }

    if (
      !Number.isInteger(closingDay) ||
      !Number.isInteger(dueDay) ||
      closingDay < 1 ||
      closingDay > 28 ||
      dueDay < 1 ||
      dueDay > 28
    ) {
      setError(cardsContent.validation.validDay);
      return;
    }

    const duplicate = existingCards.some(
      (card) =>
        card.name.toLocaleLowerCase("pt-BR") === form.name.trim().toLocaleLowerCase("pt-BR") &&
        card.lastFourDigits === form.lastFourDigits,
    );

    if (duplicate) {
      setError(cardsContent.validation.duplicateCard);
      return;
    }

    onCreate({
      name: form.name.trim(),
      institution: form.institution.trim(),
      lastFourDigits: form.lastFourDigits,
      brand: form.brand,
      style: form.style,
      limit,
      closingDay,
      dueDay,
      paymentAccountId: form.paymentAccountId,
    });

    setForm(initialForm);
    setError("");
    onClose();
  }

  return (
    <div
      className="transaction-dialog-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        className="transaction-dialog card-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="new-card-title"
      >
        <header className="transaction-dialog-header">
          <div>
            <span className="page-eyebrow">{cardsContent.newCardDialog.eyebrow}</span>
            <h2 id="new-card-title">{cardsContent.newCardDialog.title}</h2>
            <p>{cardsContent.newCardDialog.description}</p>
          </div>
          <button
            className="dialog-close-button"
            type="button"
            onClick={onClose}
            aria-label={cardsContent.newCardDialog.closeAriaLabel}
          >
            <CloseIcon />
          </button>
        </header>

        <form className="transaction-form" onSubmit={submit}>
          <div className="transaction-form-grid">
            <label className="form-field">
              <span>{cardsContent.newCardDialog.fields.name}</span>
              <input
                value={form.name}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
                placeholder={cardsContent.newCardDialog.fields.namePlaceholder}
                autoFocus
              />
            </label>

            <label className="form-field">
              <span>{cardsContent.newCardDialog.fields.institution}</span>
              <input
                value={form.institution}
                onChange={(event) => setForm({ ...form, institution: event.target.value })}
                placeholder={cardsContent.newCardDialog.fields.institutionPlaceholder}
              />
            </label>

            <label className="form-field">
              <span>{cardsContent.newCardDialog.fields.lastFourDigits}</span>
              <input
                inputMode="numeric"
                maxLength={4}
                value={form.lastFourDigits}
                onChange={(event) =>
                  setForm({
                    ...form,
                    lastFourDigits: event.target.value.replace(/\D/g, "").slice(0, 4),
                  })
                }
                placeholder="0000"
              />
            </label>

            <label className="form-field">
              <span>{cardsContent.newCardDialog.fields.brand}</span>
              <select
                value={form.brand}
                onChange={(event) => setForm({ ...form, brand: event.target.value as CardBrand })}
              >
                {(Object.keys(cardsContent.brands) as CardBrand[]).map((brand) => (
                  <option value={brand} key={brand}>{cardsContent.brands[brand]}</option>
                ))}
              </select>
            </label>

            <label className="form-field">
              <span>{cardsContent.newCardDialog.fields.limit}</span>
              <div className="currency-input">
                <b>R$</b>
                <input
                  inputMode="decimal"
                  value={form.limit}
                  onChange={(event) => setForm({ ...form, limit: event.target.value })}
                  placeholder="0,00"
                />
              </div>
            </label>

            <label className="form-field">
              <span>{cardsContent.newCardDialog.fields.paymentAccount}</span>
              <select
                value={form.paymentAccountId}
                onChange={(event) => setForm({ ...form, paymentAccountId: event.target.value })}
              >
                {accounts.map((account) => (
                  <option value={account.id} key={account.id}>{account.name}</option>
                ))}
              </select>
            </label>

            <label className="form-field">
              <span>{cardsContent.newCardDialog.fields.closingDay}</span>
              <input
                type="number"
                min="1"
                max="28"
                value={form.closingDay}
                onChange={(event) => setForm({ ...form, closingDay: event.target.value })}
                placeholder="3"
              />
            </label>

            <label className="form-field">
              <span>{cardsContent.newCardDialog.fields.dueDay}</span>
              <input
                type="number"
                min="1"
                max="28"
                value={form.dueDay}
                onChange={(event) => setForm({ ...form, dueDay: event.target.value })}
                placeholder="10"
              />
            </label>

            <label className="form-field card-style-field">
              <span>{cardsContent.newCardDialog.fields.style}</span>
              <div className="card-style-options">
                {(Object.keys(cardsContent.styles) as CardStyle[]).map((style) => (
                  <button
                    type="button"
                    className={`${style} ${form.style === style ? "active" : ""}`}
                    onClick={() => setForm({ ...form, style })}
                    key={style}
                  >
                    <i aria-hidden="true" />
                    {cardsContent.styles[style]}
                  </button>
                ))}
              </div>
            </label>
          </div>

          {error && <p className="transaction-form-error">{error}</p>}

          <footer className="transaction-dialog-footer">
            <button className="secondary-action-button" type="button" onClick={onClose}>
              {cardsContent.newCardDialog.cancel}
            </button>
            <button className="primary-action-button" type="submit">
              {cardsContent.newCardDialog.submit}
            </button>
          </footer>
        </form>
      </section>
    </div>
  );
}
