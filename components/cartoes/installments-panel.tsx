import { ClockIcon, CreditCardIcon } from "@/components/shared/icons";
import { cardsContent } from "@/content/cartoes";
import { formatCurrency, formatShortDate } from "@/lib/formatters";
import type { CreditCard, InstallmentPlan } from "@/types/cartoes";

export function InstallmentsPanel({
  plans,
  cards,
}: {
  plans: InstallmentPlan[];
  cards: CreditCard[];
}) {
  return (
    <section className="installments-panel">
      <header className="installments-heading">
        <div>
          <span>{cardsContent.installments.kicker}</span>
          <h2>{cardsContent.installments.title}</h2>
          <p>{cardsContent.installments.description}</p>
        </div>
        <span className="installments-heading-icon"><ClockIcon /></span>
      </header>

      {plans.length ? (
        <div className="installments-list">
          {plans.map((plan) => {
            const card = cards.find((item) => item.id === plan.cardId);
            const percentage = Math.min(
              100,
              (plan.paidInstallments / plan.totalInstallments) * 100,
            );
            const remaining = Math.max(
              0,
              (plan.totalInstallments - plan.paidInstallments) * plan.installmentAmount,
            );

            return (
              <article className="installment-item" key={plan.id}>
                <div className="installment-item-top">
                  <span className="installment-card-icon"><CreditCardIcon /></span>
                  <div>
                    <strong>{plan.description}</strong>
                    <span>{plan.category} · {card?.institution ?? "Cartão"} •••• {card?.lastFourDigits}</span>
                  </div>
                  <b>{formatCurrency(plan.installmentAmount)}</b>
                </div>

                <div className="installment-progress-copy">
                  <span>{cardsContent.installments.progress}</span>
                  <strong>{plan.paidInstallments}/{plan.totalInstallments}</strong>
                </div>
                <div className="installment-progress-track" aria-hidden="true">
                  <span style={{ width: `${percentage}%` }} />
                </div>

                <div className="installment-item-footer">
                  <span>
                    {cardsContent.installments.nextCharge}
                    <strong>{formatShortDate(plan.nextChargeDate)}</strong>
                  </span>
                  <span>
                    {cardsContent.installments.remaining}
                    <strong>{formatCurrency(remaining)}</strong>
                  </span>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="installments-empty-state">
          <span><ClockIcon /></span>
          <strong>{cardsContent.installments.emptyTitle}</strong>
          <p>{cardsContent.installments.emptyDescription}</p>
        </div>
      )}
    </section>
  );
}
