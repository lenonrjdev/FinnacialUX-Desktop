"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { CloseIcon } from "@/components/shared/icons";
import { cardsContent } from "@/content/cartoes";
import { formatCurrency } from "@/lib/formatters";
import { getReferenceDate } from "@/lib/reference-date";
import type { CreditCard, NewCardPurchaseInput } from "@/types/cartoes";

function createInitialForm() {
  return {
    cardId: "",
    description: "",
    category: cardsContent.categories[0] as string,
    date: getReferenceDate(),
    amount: "",
    installments: "1",
  };
}

export function NewPurchaseDialog({
  open,
  cards,
  preferredCardId,
  onClose,
  onCreate,
}: {
  open: boolean;
  cards: CreditCard[];
  preferredCardId: string;
  onClose: () => void;
  onCreate: (input: NewCardPurchaseInput) => void;
}) {
  const [form, setForm] = useState(createInitialForm);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;

    setForm((current) => ({
      ...current,
      date: getReferenceDate(),
      cardId: preferredCardId || cards[0]?.id || "",
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
  }, [cards, onClose, open, preferredCardId]);

  const selectedCard = cards.find((card) => card.id === form.cardId);
  const amount = Number(form.amount.replace(",", ".") || "0");
  const installments = Number(form.installments || "1");
  const installmentAmount = amount > 0 && installments > 0 ? amount / installments : 0;
  const available = selectedCard ? selectedCard.limit - selectedCard.usedLimit : 0;
  const availableAfter = available - amount;

  const installmentOptions = useMemo(
    () => Array.from({ length: 12 }, (_, index) => index + 1),
    [],
  );

  if (!open) return null;

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!form.cardId || !form.description.trim() || !form.category || !form.date || !form.amount) {
      setError(cardsContent.validation.required);
      return;
    }

    if (!Number.isFinite(amount) || amount <= 0) {
      setError(cardsContent.validation.positiveAmount);
      return;
    }

    if (!selectedCard || amount > available) {
      setError(cardsContent.validation.insufficientLimit);
      return;
    }

    onCreate({
      cardId: form.cardId,
      description: form.description.trim(),
      category: form.category,
      date: form.date,
      amount,
      installments,
    });

    setForm(createInitialForm());
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
        aria-labelledby="new-card-purchase-title"
      >
        <header className="transaction-dialog-header">
          <div>
            <span className="page-eyebrow">{cardsContent.newPurchaseDialog.eyebrow}</span>
            <h2 id="new-card-purchase-title">{cardsContent.newPurchaseDialog.title}</h2>
            <p>{cardsContent.newPurchaseDialog.description}</p>
          </div>
          <button
            className="dialog-close-button"
            type="button"
            onClick={onClose}
            aria-label={cardsContent.newPurchaseDialog.closeAriaLabel}
          >
            <CloseIcon />
          </button>
        </header>

        <form className="transaction-form" onSubmit={submit}>
          <div className="transaction-form-grid">
            <label className="form-field">
              <span>{cardsContent.newPurchaseDialog.fields.card}</span>
              <select
                value={form.cardId}
                onChange={(event) => setForm({ ...form, cardId: event.target.value })}
              >
                {cards.map((card) => (
                  <option value={card.id} key={card.id}>
                    {card.institution} •••• {card.lastFourDigits}
                  </option>
                ))}
              </select>
            </label>

            <label className="form-field">
              <span>{cardsContent.newPurchaseDialog.fields.description}</span>
              <input
                value={form.description}
                onChange={(event) => setForm({ ...form, description: event.target.value })}
                placeholder={cardsContent.newPurchaseDialog.fields.descriptionPlaceholder}
                autoFocus
              />
            </label>

            <label className="form-field">
              <span>{cardsContent.newPurchaseDialog.fields.category}</span>
              <select
                value={form.category}
                onChange={(event) => setForm({ ...form, category: event.target.value })}
              >
                {cardsContent.categories.map((category) => (
                  <option value={category} key={category}>{category}</option>
                ))}
              </select>
            </label>

            <label className="form-field">
              <span>{cardsContent.newPurchaseDialog.fields.date}</span>
              <input
                type="date"
                value={form.date}
                onChange={(event) => setForm({ ...form, date: event.target.value })}
              />
            </label>

            <label className="form-field">
              <span>{cardsContent.newPurchaseDialog.fields.amount}</span>
              <div className="currency-input">
                <b>R$</b>
                <input
                  inputMode="decimal"
                  value={form.amount}
                  onChange={(event) => setForm({ ...form, amount: event.target.value })}
                  placeholder="0,00"
                />
              </div>
            </label>

            <label className="form-field">
              <span>{cardsContent.newPurchaseDialog.fields.installments}</span>
              <select
                value={form.installments}
                onChange={(event) => setForm({ ...form, installments: event.target.value })}
              >
                {installmentOptions.map((option) => (
                  <option value={option} key={option}>
                    {option === 1 ? "1 vez" : `${option} vezes`}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="card-purchase-preview">
            <div>
              <span>{cardsContent.newPurchaseDialog.installmentPreview}</span>
              <strong>{formatCurrency(installmentAmount)}</strong>
            </div>
            <div className={availableAfter < 0 ? "negative" : ""}>
              <span>{cardsContent.newPurchaseDialog.limitAfterPurchase}</span>
              <strong>{formatCurrency(Math.max(0, availableAfter))}</strong>
            </div>
          </div>

          {error && <p className="transaction-form-error">{error}</p>}

          <footer className="transaction-dialog-footer">
            <button className="secondary-action-button" type="button" onClick={onClose}>
              {cardsContent.newPurchaseDialog.cancel}
            </button>
            <button className="primary-action-button" type="submit">
              {cardsContent.newPurchaseDialog.submit}
            </button>
          </footer>
        </form>
      </section>
    </div>
  );
}
