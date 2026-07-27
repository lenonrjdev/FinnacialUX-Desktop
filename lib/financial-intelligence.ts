import { financialIntelligenceContent } from "@/content/financial-intelligence";
import type { PersonalSubscription, SubscriptionCharge } from "@/types/assinaturas";
import type { FinancialCalendarEvent } from "@/types/calendario";
import type { CardInvoice, CreditCard } from "@/types/cartoes";
import type { Payable, PayableStatus } from "@/types/contas-a-pagar";
import type { FinancialDebt } from "@/types/dividas";
import type { UnifiedCalendarEvent, UnifiedPayable } from "@/types/financial-intelligence";
import type { Receivable } from "@/types/recebimentos";


function createUtcDate(value: string): Date {
  return new Date(`${value}T12:00:00Z`);
}

function toDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function daysInUtcMonth(year: number, monthIndex: number): number {
  return new Date(Date.UTC(year, monthIndex + 1, 0, 12)).getUTCDate();
}

export function addDaysToDate(value: string, days: number): string {
  const date = createUtcDate(value);
  date.setUTCDate(date.getUTCDate() + days);
  return toDateKey(date);
}

export function addMonthsToDate(value: string, months: number): string {
  const source = createUtcDate(value);
  const originalDay = source.getUTCDate();
  const targetMonthIndex = source.getUTCMonth() + months;
  const targetYear = source.getUTCFullYear() + Math.floor(targetMonthIndex / 12);
  const normalizedMonth = ((targetMonthIndex % 12) + 12) % 12;
  const day = Math.min(originalDay, daysInUtcMonth(targetYear, normalizedMonth));
  return toDateKey(new Date(Date.UTC(targetYear, normalizedMonth, day, 12)));
}

export function addYearsToDate(value: string, years: number): string {
  const source = createUtcDate(value);
  const year = source.getUTCFullYear() + years;
  const month = source.getUTCMonth();
  const day = Math.min(source.getUTCDate(), daysInUtcMonth(year, month));
  return toDateKey(new Date(Date.UTC(year, month, day, 12)));
}

export function endOfMonth(value: string): string {
  const date = createUtcDate(`${value.slice(0, 7)}-01`);
  date.setUTCMonth(date.getUTCMonth() + 1);
  date.setUTCDate(0);
  return toDateKey(date);
}

export function advanceBillingCycle(
  value: string,
  cycle: PersonalSubscription["billingCycle"],
): string {
  if (cycle === "weekly") return addDaysToDate(value, 7);
  if (cycle === "monthly") return addMonthsToDate(value, 1);
  if (cycle === "quarterly") return addMonthsToDate(value, 3);
  if (cycle === "semiannual") return addMonthsToDate(value, 6);
  return addYearsToDate(value, 1);
}

export function resolvePayableStatus({
  amount,
  paidAmount,
  dueDate,
  referenceDate,
}: {
  amount: number;
  paidAmount: number;
  dueDate: string;
  referenceDate: string;
}): PayableStatus {
  if (paidAmount >= amount - 0.001) return "paid";
  if (paidAmount > 0) return "partial";
  if (dueDate < referenceDate) return "overdue";
  return "pending";
}

function sourceLabel(
  source: UnifiedPayable["sourceType"],
  detail?: string,
): string {
  const base = financialIntelligenceContent.sources[source];
  return detail ? `${base} · ${detail}` : base;
}

function mapManualPayables(
  payables: Payable[],
  referenceDate: string,
): UnifiedPayable[] {
  return payables.map((payable) => ({
    ...payable,
    status: resolvePayableStatus({
      amount: payable.amount,
      paidAmount: payable.paidAmount,
      dueDate: payable.dueDate,
      referenceDate,
    }),
    sourceType: "manual-payable" as const,
    sourceRecordId: payable.id,
    sourceLabel: sourceLabel("manual-payable"),
    occurrenceDate: payable.dueDate,
    generated: false,
  }));
}

function mapCardInvoices(
  invoices: CardInvoice[],
  cards: CreditCard[],
  referenceDate: string,
): UnifiedPayable[] {
  const cardsById = new Map(cards.map((card) => [card.id, card]));

  return invoices
    .filter((invoice) => invoice.amount > 0)
    .map((invoice) => {
      const card = cardsById.get(invoice.cardId);
      const paidAmount = invoice.status === "paid"
        ? invoice.amount
        : Math.min(invoice.paidAmount ?? 0, invoice.amount);

      return {
        id: `invoice::${invoice.id}`,
        description: card
          ? `${financialIntelligenceContent.accounting.cardInvoiceTitle} ${card.name} · ${invoice.referenceLabel}`
          : `${financialIntelligenceContent.accounting.genericCardInvoiceTitle} · ${invoice.referenceLabel}`,
        category: financialIntelligenceContent.accounting.cardInvoiceCategory,
        amount: invoice.amount,
        paidAmount,
        dueDate: invoice.dueDate,
        accountId: card?.paymentAccountId ?? "",
        status: resolvePayableStatus({
          amount: invoice.amount,
          paidAmount,
          dueDate: invoice.dueDate,
          referenceDate,
        }),
        recurrence: "none" as const,
        valueType: "variable" as const,
        notes: card ? `${card.institution} · final ${card.lastFourDigits}` : undefined,
        createdAt: invoice.closingDate,
        paidAt: invoice.paymentDate,
        sourceType: "card-invoice" as const,
        sourceRecordId: invoice.id,
        sourceLabel: sourceLabel("card-invoice", card?.name),
        occurrenceDate: invoice.dueDate,
        generated: true,
      };
    });
}

function mapSubscriptions(
  subscriptions: PersonalSubscription[],
  charges: SubscriptionCharge[],
  referenceDate: string,
): UnifiedPayable[] {
  const chargeByOccurrence = new Map(
    charges.map((charge) => [`${charge.subscriptionId}::${charge.date}`, charge]),
  );

  return subscriptions.flatMap((subscription) => {
    if (subscription.status === "paused" || subscription.status === "cancelled") return [];

    const occurrenceDate = subscription.nextChargeDate;
    const charge = chargeByOccurrence.get(`${subscription.id}::${occurrenceDate}`);
    const paidAmount = charge?.status === "paid" || charge?.status === "skipped"
      ? subscription.amount
      : Math.min(charge?.paidAmount ?? 0, subscription.amount);

    return [{
      id: `subscription::${subscription.id}::${occurrenceDate}`,
      description: subscription.name,
      category: financialIntelligenceContent.accounting.subscriptionCategory,
      amount: subscription.amount,
      paidAmount,
      dueDate: occurrenceDate,
      accountId: charge?.accountId ?? subscription.accountId,
      status: resolvePayableStatus({
        amount: subscription.amount,
        paidAmount,
        dueDate: occurrenceDate,
        referenceDate,
      }),
      recurrence: subscription.billingCycle === "weekly"
        ? "weekly"
        : subscription.billingCycle === "annual"
          ? "yearly"
          : "monthly",
      valueType: "fixed" as const,
      notes: [subscription.provider, subscription.notes].filter(Boolean).join(" · "),
      createdAt: subscription.createdAt,
      paidAt: charge?.status === "paid" ? charge.date : undefined,
      sourceType: "subscription" as const,
      sourceRecordId: subscription.id,
      sourceLabel: sourceLabel("subscription", subscription.provider),
      occurrenceDate,
      generated: true,
    }];
  });
}

function mapDebtInstallments(
  debts: FinancialDebt[],
  referenceDate: string,
): UnifiedPayable[] {
  return debts.flatMap((debt) => {
    if (debt.status === "paid" || debt.currentBalance <= 0) return [];

    const remainingInstallments = Math.max(debt.totalInstallments - debt.paidInstallments, 1);
    const dueDate = debt.nextDueDate;
    const amount = Math.min(debt.installmentAmount || debt.currentBalance, debt.currentBalance);
    const storedPayment = debt.installmentPayments?.[dueDate];
    const paidAmount = Math.min(storedPayment?.paidAmount ?? 0, amount);

    return [{
      id: `debt-installment::${debt.id}::${dueDate}`,
      description: `${financialIntelligenceContent.accounting.debtInstallmentTitle} · ${debt.name}`,
      category: financialIntelligenceContent.accounting.debtInstallmentCategory,
      amount,
      paidAmount,
      dueDate,
      accountId: storedPayment?.accountId ?? debt.accountId,
      status: resolvePayableStatus({
        amount,
        paidAmount,
        dueDate,
        referenceDate,
      }),
      recurrence: remainingInstallments > 1 ? "monthly" as const : "none" as const,
      valueType: "fixed" as const,
      notes: debt.creditor,
      createdAt: debt.createdAt,
      paidAt: storedPayment?.paidAt,
      sourceType: "debt-installment" as const,
      sourceRecordId: debt.id,
      sourceLabel: sourceLabel("debt-installment", debt.creditor),
      occurrenceDate: dueDate,
      generated: true,
    }];
  });
}

export function buildUnifiedPayables({
  payables,
  cards,
  invoices,
  subscriptions,
  subscriptionCharges,
  debts,
  referenceDate,
}: {
  payables: Payable[];
  cards: CreditCard[];
  invoices: CardInvoice[];
  subscriptions: PersonalSubscription[];
  subscriptionCharges: SubscriptionCharge[];
  debts: FinancialDebt[];
  referenceDate: string;
}): UnifiedPayable[] {
  const statusOrder: Record<PayableStatus, number> = {
    overdue: 0,
    pending: 1,
    partial: 2,
    paid: 3,
  };

  return [
    ...mapManualPayables(payables, referenceDate),
    ...mapCardInvoices(invoices, cards, referenceDate),
    ...mapSubscriptions(subscriptions, subscriptionCharges, referenceDate),
    ...mapDebtInstallments(debts, referenceDate),
  ].sort((a, b) => (
    statusOrder[a.status] - statusOrder[b.status]
    || a.dueDate.localeCompare(b.dueDate)
    || a.description.localeCompare(b.description, "pt-BR")
  ));
}

function payableEventType(payable: UnifiedPayable): FinancialCalendarEvent["type"] {
  if (payable.sourceType === "card-invoice") return "invoice";
  if (payable.sourceType === "subscription") return "subscription";
  return "expense";
}

function payableEventSource(payable: UnifiedPayable): FinancialCalendarEvent["source"] {
  if (payable.sourceType === "card-invoice") return "invoice";
  if (payable.sourceType === "subscription") return "subscription";
  if (payable.sourceType === "debt-installment") return "debt";
  return "payable";
}

export function buildUnifiedCalendarEvents({
  manualEvents,
  unifiedPayables,
  receivables,
  subscriptions,
  subscriptionCharges,
  referenceDate,
}: {
  manualEvents: FinancialCalendarEvent[];
  unifiedPayables: UnifiedPayable[];
  receivables: Receivable[];
  subscriptions: PersonalSubscription[];
  subscriptionCharges: SubscriptionCharge[];
  referenceDate: string;
}): UnifiedCalendarEvent[] {
  const subscriptionsById = new Map(subscriptions.map((item) => [item.id, item]));
  const representedSubscriptionOccurrences = new Set(
    unifiedPayables
      .filter((item) => item.sourceType === "subscription")
      .map((item) => `${item.sourceRecordId}::${item.occurrenceDate}`),
  );

  const payableEvents: UnifiedCalendarEvent[] = unifiedPayables.map((payable) => ({
    id: `calendar::${payable.id}`,
    title: payable.description,
    type: payableEventType(payable),
    status: payable.status === "paid"
      ? "completed"
      : payable.status === "overdue"
        ? "overdue"
        : "scheduled",
    amount: Math.max(payable.amount - payable.paidAmount, 0),
    date: payable.dueDate,
    category: payable.category,
    accountId: payable.accountId,
    recurrence: payable.recurrence,
    source: payableEventSource(payable),
    notes: [payable.sourceLabel, payable.notes].filter(Boolean).join(" · "),
    sourceType: payable.sourceType,
    sourceRecordId: payable.id,
    sourceLabel: payable.sourceLabel,
    generated: true,
  }));

  const receivableEvents: UnifiedCalendarEvent[] = receivables.map((receivable) => ({
    id: `calendar::receivable::${receivable.id}`,
    title: receivable.description,
    type: "income",
    status: receivable.status === "received"
      ? "completed"
      : receivable.expectedDate < referenceDate
        ? "overdue"
        : "scheduled",
    amount: Math.max(receivable.amount - receivable.receivedAmount, 0),
    date: receivable.expectedDate,
    category: receivable.category,
    accountId: receivable.accountId,
    recurrence: receivable.recurrence,
    source: "receivable",
    notes: [receivable.source, receivable.payer, receivable.notes].filter(Boolean).join(" · "),
    sourceType: "receivable",
    sourceRecordId: receivable.id,
    sourceLabel: receivable.source,
    generated: true,
  }));

  const historicalSubscriptionEvents: UnifiedCalendarEvent[] = subscriptionCharges
    .filter((charge) => !representedSubscriptionOccurrences.has(`${charge.subscriptionId}::${charge.date}`))
    .map((charge) => {
      const subscription = subscriptionsById.get(charge.subscriptionId);
      return {
        id: `calendar::subscription-charge::${charge.id}`,
        title: subscription?.name ?? financialIntelligenceContent.accounting.subscriptionFallback,
        type: "subscription",
        status: charge.status === "paid" || charge.status === "skipped"
          ? "completed"
          : charge.date < referenceDate
            ? "overdue"
            : "scheduled",
        amount: charge.status === "skipped"
          ? 0
          : Math.max(charge.amount - (charge.paidAmount ?? 0), 0),
        date: charge.date,
        category: financialIntelligenceContent.accounting.subscriptionCategory,
        accountId: charge.accountId,
        recurrence: "none",
        source: "subscription",
        notes: [subscription?.provider, charge.note].filter(Boolean).join(" · "),
        sourceType: "subscription",
        sourceRecordId: charge.subscriptionId,
        sourceLabel: subscription?.provider,
        generated: true,
      };
    });

  const byId = new Map<string, UnifiedCalendarEvent>();
  [...manualEvents.map((event) => ({ ...event, sourceType: "manual" as const, generated: false })), ...payableEvents, ...receivableEvents, ...historicalSubscriptionEvents]
    .forEach((event) => byId.set(event.id, event));

  return Array.from(byId.values()).sort((a, b) => (
    a.date.localeCompare(b.date)
    || a.title.localeCompare(b.title, "pt-BR")
  ));
}

export function buildOperationalDebts(
  unifiedPayables: UnifiedPayable[],
  referenceDate: string,
): FinancialDebt[] {
  return unifiedPayables
    .filter((payable) => (
      payable.status === "overdue"
      && payable.sourceType !== "debt-installment"
      && payable.amount - payable.paidAmount > 0.001
    ))
    .map((payable) => {
      const currentBalance = Math.max(payable.amount - payable.paidAmount, 0);
      const overdueDays = Math.max(
        0,
        Math.floor((createUtcDate(referenceDate).getTime() - createUtcDate(payable.dueDate).getTime()) / 86400000),
      );

      return {
        id: `operational-debt::${payable.id}`,
        name: payable.description,
        creditor: payable.sourceLabel,
        type: payable.sourceType === "card-invoice" ? "credit-card-installment" : "other",
        originalAmount: payable.amount,
        currentBalance,
        annualInterestRate: 0,
        totalInstallments: 1,
        paidInstallments: 0,
        installmentAmount: currentBalance,
        nextDueDate: payable.dueDate,
        startDate: payable.dueDate,
        accountId: payable.accountId,
        status: "overdue",
        priority: overdueDays >= 30 ? "high" : "medium",
        notes: `${financialIntelligenceContent.debts.automatic} · ${payable.category}`,
        createdAt: payable.createdAt,
        origin: payable.sourceType === "manual-payable"
          ? "payable"
          : payable.sourceType === "card-invoice"
            ? "card-invoice"
            : payable.sourceType === "subscription"
              ? "subscription"
              : "manual",
        originCommitmentId: payable.id,
        generated: true,
      } satisfies FinancialDebt;
    });
}
