"use client";

import { useMemo } from "react";
import { useFinanceDataState } from "@/components/providers/finance-data-provider";
import { financialIntelligenceContent } from "@/content/financial-intelligence";
import { initialSubscriptions, initialSubscriptionCharges } from "@/data/assinaturas";
import {
  initialCardInvoices,
  initialCardPurchases,
  initialCreditCards,
  initialInstallmentPlans,
} from "@/data/cartoes";
import { initialPayables } from "@/data/contas-a-pagar";
import { initialAccountMovements, initialAccounts } from "@/data/contas";
import { initialDebts, initialDebtPayments } from "@/data/dividas";
import { transactionsData } from "@/data/lancamentos";
import { initialReceivables } from "@/data/recebimentos";
import { initialCalendarEvents } from "@/data/calendario";
import {
  advanceBillingCycle,
  addMonthsToDate,
  buildOperationalDebts,
  buildUnifiedCalendarEvents,
  buildUnifiedPayables,
} from "@/lib/financial-intelligence";
import { getReferenceDate } from "@/lib/reference-date";
import type {
  PersonalSubscription,
  SubscriptionCharge,
  SubscriptionChargeInput,
} from "@/types/assinaturas";
import type { UnifiedCalendarEvent, UnifiedPayable } from "@/types/financial-intelligence";
import type {
  CardInvoice,
  CardPurchase,
  CreditCard,
  InstallmentPlan,
  InvoicePaymentInput,
} from "@/types/cartoes";
import type { Payable, PayablePaymentInput } from "@/types/contas-a-pagar";
import type { AccountMovement, FinancialAccount } from "@/types/contas";
import type { DebtPayment, DebtPaymentInput, FinancialDebt } from "@/types/dividas";
import type { FinancialTransaction, NewTransactionInput } from "@/types/lancamentos";
import type { Receivable, ReceivableReceiptInput } from "@/types/recebimentos";
import type { FinancialCalendarEvent } from "@/types/calendario";

function createRuntimeId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function clampPayment(amount: number, remaining: number): number {
  if (!Number.isFinite(amount) || amount <= 0) return 0;
  return Math.min(amount, Math.max(remaining, 0));
}

export function useFinancialIntelligence() {
  const referenceDate = getReferenceDate();
  const [accounts, setAccounts] = useFinanceDataState<FinancialAccount[]>("accounts", initialAccounts);
  const [accountMovements, setAccountMovements] = useFinanceDataState<AccountMovement[]>(
    "account-movements",
    initialAccountMovements,
  );
  const [transactions, setTransactions] = useFinanceDataState<FinancialTransaction[]>(
    "transactions",
    transactionsData,
  );
  const [payables, setPayables] = useFinanceDataState<Payable[]>("payables", initialPayables);
  const [receivables, setReceivables] = useFinanceDataState<Receivable[]>(
    "receivables",
    initialReceivables,
  );
  const [cards, setCards] = useFinanceDataState<CreditCard[]>("credit-cards", initialCreditCards);
  const [invoices, setInvoices] = useFinanceDataState<CardInvoice[]>("card-invoices", initialCardInvoices);
  const [cardPurchases, setCardPurchases] = useFinanceDataState<CardPurchase[]>(
    "card-purchases",
    initialCardPurchases,
  );
  const [installmentPlans, setInstallmentPlans] = useFinanceDataState<InstallmentPlan[]>(
    "installment-plans",
    initialInstallmentPlans,
  );
  const [subscriptions, setSubscriptions] = useFinanceDataState<PersonalSubscription[]>(
    "subscriptions",
    initialSubscriptions,
  );
  const [subscriptionCharges, setSubscriptionCharges] = useFinanceDataState<SubscriptionCharge[]>(
    "subscription-charges",
    initialSubscriptionCharges,
  );
  const [debts, setDebts] = useFinanceDataState<FinancialDebt[]>("debts", initialDebts);
  const [debtPayments, setDebtPayments] = useFinanceDataState<DebtPayment[]>(
    "debt-payments",
    initialDebtPayments,
  );
  const [manualCalendarEvents, setManualCalendarEvents] = useFinanceDataState<FinancialCalendarEvent[]>(
    "calendar-events",
    initialCalendarEvents,
  );

  const unifiedPayables = useMemo(
    () => buildUnifiedPayables({
      payables,
      cards,
      invoices,
      subscriptions,
      subscriptionCharges,
      debts,
      referenceDate,
    }),
    [cards, debts, invoices, payables, referenceDate, subscriptionCharges, subscriptions],
  );

  const calendarEvents = useMemo(
    () => buildUnifiedCalendarEvents({
      manualEvents: manualCalendarEvents,
      unifiedPayables,
      receivables,
      subscriptions,
      subscriptionCharges,
      referenceDate,
    }),
    [manualCalendarEvents, receivables, referenceDate, subscriptionCharges, subscriptions, unifiedPayables],
  );

  const operationalDebts = useMemo(
    () => buildOperationalDebts(unifiedPayables, referenceDate),
    [referenceDate, unifiedPayables],
  );

  const accountNames = useMemo(
    () => Object.fromEntries(accounts.map((account) => [account.id, account.name])),
    [accounts],
  );

  function changeAccountBalance(accountId: string, delta: number) {
    if (!accountId || !delta) return;
    setAccounts((current) => current.map((account) => account.id === accountId ? {
      ...account,
      balance: account.balance + delta,
      projectedBalance: account.projectedBalance + delta,
    } : account));
  }

  function appendAccountingEntry({
    direction,
    amount,
    accountId,
    date,
    description,
    category,
    paymentMethod,
    sourceType,
    sourceId,
  }: {
    direction: "income" | "expense";
    amount: number;
    accountId: string;
    date: string;
    description: string;
    category: string;
    paymentMethod: string;
    sourceType: string;
    sourceId: string;
  }) {
    if (amount <= 0) return;
    const transactionId = createRuntimeId("transaction");
    const accountName = accountNames[accountId] ?? financialIntelligenceContent.accounting.accountNotProvided;
    const transaction: FinancialTransaction = {
      id: transactionId,
      description,
      category,
      account: accountName,
      paymentMethod,
      date,
      amount,
      type: direction,
      status: "completed",
      sourceType,
      sourceId,
    };
    const movement: AccountMovement = {
      id: createRuntimeId("movement"),
      accountId,
      description,
      category,
      date,
      amount,
      type: direction,
      sourceType,
      sourceId,
    };

    setTransactions((current) => [transaction, ...current]);
    if (accountId) setAccountMovements((current) => [movement, ...current]);
    changeAccountBalance(accountId, direction === "income" ? amount : -amount);
  }

  function findAccountIdByName(name: string): string {
    return accounts.find((account) => account.name === name)?.id ?? "";
  }

  function recordManualTransaction(input: NewTransactionInput): FinancialTransaction {
    const transaction: FinancialTransaction = {
      ...input,
      id: createRuntimeId("transaction"),
      sourceType: "manual-transaction",
    };
    transaction.sourceId = transaction.id;
    setTransactions((current) => [transaction, ...current]);

    if (transaction.status === "completed") {
      const sourceAccountId = findAccountIdByName(transaction.account);
      const destinationAccountId = transaction.destinationAccount
        ? findAccountIdByName(transaction.destinationAccount)
        : "";

      if (transaction.type === "income") {
        changeAccountBalance(sourceAccountId, transaction.amount);
      } else if (transaction.type === "expense") {
        changeAccountBalance(sourceAccountId, -transaction.amount);
      } else {
        changeAccountBalance(sourceAccountId, -transaction.amount);
        changeAccountBalance(destinationAccountId, transaction.amount);
      }

      const movement: AccountMovement = {
        id: createRuntimeId("movement"),
        accountId: sourceAccountId,
        destinationAccountId: destinationAccountId || undefined,
        description: transaction.description,
        category: transaction.category,
        date: transaction.date,
        amount: transaction.amount,
        type: transaction.type,
        sourceType: "manual-transaction",
        sourceId: transaction.id,
      };
      setAccountMovements((current) => [movement, ...current]);
    }

    return transaction;
  }

  function removeManualTransaction(transactionId: string): boolean {
    const transaction = transactions.find((item) => item.id === transactionId);
    if (!transaction || (transaction.sourceType && transaction.sourceType !== "manual-transaction")) return false;

    if (transaction.status === "completed") {
      const sourceAccountId = findAccountIdByName(transaction.account);
      const destinationAccountId = transaction.destinationAccount
        ? findAccountIdByName(transaction.destinationAccount)
        : "";
      if (transaction.type === "income") changeAccountBalance(sourceAccountId, -transaction.amount);
      if (transaction.type === "expense") changeAccountBalance(sourceAccountId, transaction.amount);
      if (transaction.type === "transfer") {
        changeAccountBalance(sourceAccountId, transaction.amount);
        changeAccountBalance(destinationAccountId, -transaction.amount);
      }
    }

    setTransactions((current) => current.filter((item) => item.id !== transactionId));
    setAccountMovements((current) => current.filter((item) => item.sourceId !== transactionId));
    return true;
  }

  function advanceSubscriptionAfterProcessedCharge(
    subscription: PersonalSubscription,
    nextCharges: SubscriptionCharge[],
  ): PersonalSubscription {
    let nextChargeDate = subscription.nextChargeDate;
    let guard = 0;

    while (guard < 120) {
      const charge = nextCharges.find((item) => (
        item.subscriptionId === subscription.id
        && item.date === nextChargeDate
        && (item.status === "paid" || item.status === "skipped")
      ));
      if (!charge) break;
      const advanced = advanceBillingCycle(nextChargeDate, subscription.billingCycle);
      if (advanced === nextChargeDate) break;
      nextChargeDate = advanced;
      guard += 1;
      if (guard > 120) break;
    }

    const hasPaidCharge = nextCharges.some((charge) => (
      charge.subscriptionId === subscription.id && charge.status === "paid"
    ));

    return {
      ...subscription,
      nextChargeDate,
      status: subscription.status === "trial" && hasPaidCharge ? "active" : subscription.status,
    };
  }

  function recordCommitmentPayment(
    commitment: UnifiedPayable,
    input: PayablePaymentInput,
  ): { paid: boolean; amount: number } {
    const remaining = Math.max(commitment.amount - commitment.paidAmount, 0);
    const amount = clampPayment(input.amount, remaining);
    if (!amount) return { paid: false, amount: 0 };
    const fullyPaid = commitment.paidAmount + amount >= commitment.amount - 0.001;

    if (commitment.sourceType === "manual-payable") {
      setPayables((current) => current.map((payable) => {
        if (payable.id !== commitment.sourceRecordId) return payable;
        const nextPaid = Math.min(payable.amount, payable.paidAmount + amount);
        const paid = nextPaid >= payable.amount - 0.001;
        return {
          ...payable,
          accountId: input.accountId,
          paidAmount: nextPaid,
          status: paid ? "paid" : "partial",
          paidAt: paid ? input.paymentDate : payable.paidAt,
        };
      }));
    }

    if (commitment.sourceType === "card-invoice") {
      const invoice = invoices.find((item) => item.id === commitment.sourceRecordId);
      if (invoice) {
        const previousPaid = invoice.status === "paid" ? invoice.amount : invoice.paidAmount ?? 0;
        const nextPaid = Math.min(invoice.amount, previousPaid + amount);
        const invoicePaid = nextPaid >= invoice.amount - 0.001;
        setInvoices((current) => current.map((item) => item.id === invoice.id ? {
          ...item,
          paidAmount: nextPaid,
          status: invoicePaid ? "paid" : item.status,
          paymentDate: invoicePaid ? input.paymentDate : item.paymentDate,
        } : item));
        setCards((current) => current.map((card) => card.id === invoice.cardId ? {
          ...card,
          usedLimit: Math.max(0, card.usedLimit - amount),
        } : card));
        if (invoicePaid) {
          setInstallmentPlans((current) => current.map((plan) => (
            plan.cardId === invoice.cardId && plan.paidInstallments < plan.totalInstallments
              ? { ...plan, paidInstallments: plan.paidInstallments + 1 }
              : plan
          )));
        }
      }
    }

    if (commitment.sourceType === "subscription") {
      const subscription = subscriptions.find((item) => item.id === commitment.sourceRecordId);
      if (subscription) {
        const existingCharge = subscriptionCharges.find((charge) => (
          charge.subscriptionId === subscription.id
          && charge.date === commitment.occurrenceDate
        ));
        const previousPaid = existingCharge?.status === "paid"
          ? existingCharge.amount
          : existingCharge?.paidAmount ?? 0;
        const nextPaid = Math.min(subscription.amount, previousPaid + amount);
        const chargePaid = nextPaid >= subscription.amount - 0.001;
        const nextCharge: SubscriptionCharge = {
          id: existingCharge?.id ?? createRuntimeId("subscription-charge"),
          subscriptionId: subscription.id,
          date: commitment.occurrenceDate,
          amount: subscription.amount,
          accountId: input.accountId,
          status: chargePaid
            ? "paid"
            : commitment.occurrenceDate < referenceDate
              ? "overdue"
              : "scheduled",
          paidAmount: nextPaid,
          note: existingCharge?.note || financialIntelligenceContent.accounting.commitmentPaymentNote,
        };
        const nextCharges = existingCharge
          ? subscriptionCharges.map((charge) => charge.id === existingCharge.id ? nextCharge : charge)
          : [nextCharge, ...subscriptionCharges];
        setSubscriptionCharges(nextCharges);
        if (chargePaid) {
          setSubscriptions((current) => current.map((item) => item.id === subscription.id
            ? advanceSubscriptionAfterProcessedCharge(item, nextCharges)
            : item));
        }
      }
    }

    if (commitment.sourceType === "debt-installment") {
      const debt = debts.find((item) => item.id === commitment.sourceRecordId);
      if (debt) {
        const storedInstallment = debt.installmentPayments?.[commitment.occurrenceDate];
        const previousInstallmentPaid = Math.min(storedInstallment?.paidAmount ?? 0, commitment.amount);
        const nextInstallmentPaid = Math.min(commitment.amount, previousInstallmentPaid + amount);
        const interest = Math.min(debt.currentBalance * (debt.annualInterestRate / 1200), amount);
        const principal = Math.min(Math.max(amount - interest, 0), debt.currentBalance);
        const nextBalance = Math.max(debt.currentBalance - principal, 0);
        const installmentCompleted = nextInstallmentPaid >= commitment.amount - 0.001;
        const nextPaidInstallments = nextBalance <= 0
          ? debt.totalInstallments
          : Math.min(debt.paidInstallments + (installmentCompleted ? 1 : 0), debt.totalInstallments);
        const payment: DebtPayment = {
          id: createRuntimeId("debt-payment"),
          debtId: debt.id,
          date: input.paymentDate,
          amount,
          principal,
          interest,
          accountId: input.accountId,
          note: financialIntelligenceContent.accounting.commitmentPaymentNote,
        };
        setDebtPayments((current) => [payment, ...current]);
        setDebts((current) => current.map((item) => item.id === debt.id ? {
          ...item,
          currentBalance: nextBalance,
          paidInstallments: nextPaidInstallments,
          nextDueDate: installmentCompleted && nextBalance > 0
            ? addMonthsToDate(item.nextDueDate, 1)
            : item.nextDueDate,
          status: nextBalance <= 0 ? "paid" : "active",
          installmentPayments: {
            ...(item.installmentPayments ?? {}),
            [commitment.occurrenceDate]: {
              paidAmount: nextInstallmentPaid,
              paidAt: installmentCompleted ? input.paymentDate : storedInstallment?.paidAt,
              accountId: input.accountId,
            },
          },
        } : item));
      }
    }

    appendAccountingEntry({
      direction: "expense",
      amount,
      accountId: input.accountId,
      date: input.paymentDate,
      description: `${financialIntelligenceContent.accounting.commitmentPaymentTitle} · ${commitment.description}`,
      category: commitment.category,
      paymentMethod: financialIntelligenceContent.accounting.commitmentPaymentMethod,
      sourceType: commitment.sourceType,
      sourceId: `${commitment.id}::${createRuntimeId("payment")}`,
    });

    return { paid: fullyPaid, amount };
  }

  function recordInvoicePayment(input: InvoicePaymentInput): boolean {
    const commitment = unifiedPayables.find((item) => (
      item.sourceType === "card-invoice"
      && item.sourceRecordId === input.invoiceId
    ));
    if (!commitment) return false;
    recordCommitmentPayment(commitment, {
      payableId: commitment.id,
      amount: Math.max(commitment.amount - commitment.paidAmount, 0),
      paymentDate: input.paymentDate,
      accountId: input.accountId,
    });
    return true;
  }

  function recordReceivableReceipt(input: ReceivableReceiptInput): { received: boolean; amount: number } {
    const receivable = receivables.find((item) => item.id === input.receivableId);
    if (!receivable) return { received: false, amount: 0 };
    const remaining = Math.max(receivable.amount - receivable.receivedAmount, 0);
    const amount = clampPayment(input.amount, remaining);
    if (!amount) return { received: false, amount: 0 };
    const nextReceived = Math.min(receivable.amount, receivable.receivedAmount + amount);
    const received = nextReceived >= receivable.amount - 0.001;

    setReceivables((current) => current.map((item) => item.id === receivable.id ? {
      ...item,
      accountId: input.accountId,
      receivedAmount: nextReceived,
      status: received ? "received" : "partial",
      receivedAt: received ? input.receivedDate : item.receivedAt,
    } : item));

    appendAccountingEntry({
      direction: "income",
      amount,
      accountId: input.accountId,
      date: input.receivedDate,
      description: `${financialIntelligenceContent.accounting.receiptPaymentTitle} · ${receivable.description}`,
      category: receivable.category,
      paymentMethod: financialIntelligenceContent.accounting.receiptPaymentMethod,
      sourceType: "receivable",
      sourceId: `${receivable.id}::${createRuntimeId("receipt")}`,
    });

    return { received, amount };
  }

  function recordSubscriptionCharge(input: SubscriptionChargeInput): boolean {
    const subscription = subscriptions.find((item) => item.id === input.subscriptionId);
    if (!subscription) return false;
    const existing = subscriptionCharges.find((charge) => (
      charge.subscriptionId === input.subscriptionId
      && charge.date === input.date
    ));
    const nextCharge: SubscriptionCharge = {
      id: existing?.id ?? createRuntimeId("subscription-charge"),
      ...input,
      paidAmount: input.status === "paid" ? input.amount : existing?.paidAmount,
    };
    const nextCharges = existing
      ? subscriptionCharges.map((charge) => charge.id === existing.id ? nextCharge : charge)
      : [nextCharge, ...subscriptionCharges];
    setSubscriptionCharges(nextCharges);

    if (input.status === "paid" && existing?.status !== "paid") {
      appendAccountingEntry({
        direction: "expense",
        amount: input.amount,
        accountId: input.accountId,
        date: input.date,
        description: `${financialIntelligenceContent.accounting.subscriptionPaymentTitle} · ${subscription.name}`,
        category: financialIntelligenceContent.accounting.subscriptionCategory,
        paymentMethod: financialIntelligenceContent.accounting.subscriptionPaymentMethod,
        sourceType: "subscription",
        sourceId: `${subscription.id}::${input.date}`,
      });
    }

    if (input.status === "paid" || input.status === "skipped") {
      setSubscriptions((current) => current.map((item) => item.id === subscription.id
        ? advanceSubscriptionAfterProcessedCharge(item, nextCharges)
        : item));
    }
    return true;
  }

  function recordDebtPayment(input: DebtPaymentInput): { settled: boolean; amount: number } {
    const debt = debts.find((item) => item.id === input.debtId);
    if (!debt) return { settled: false, amount: 0 };
    const amount = clampPayment(input.amount, debt.currentBalance + (debt.currentBalance * debt.annualInterestRate / 1200));
    if (!amount) return { settled: false, amount: 0 };
    const installmentDate = debt.nextDueDate;
    const storedInstallment = debt.installmentPayments?.[installmentDate];
    const previousInstallmentPaid = Math.min(storedInstallment?.paidAmount ?? 0, debt.installmentAmount);
    const nextInstallmentPaid = Math.min(debt.installmentAmount, previousInstallmentPaid + amount);
    const interest = Math.min(debt.currentBalance * (debt.annualInterestRate / 1200), amount);
    const principal = Math.min(Math.max(amount - interest, 0), debt.currentBalance);
    const nextBalance = Math.max(debt.currentBalance - principal, 0);
    const installmentCompleted = nextInstallmentPaid >= debt.installmentAmount - 0.001;
    const nextPaidInstallments = nextBalance <= 0
      ? debt.totalInstallments
      : Math.min(debt.paidInstallments + (installmentCompleted ? 1 : 0), debt.totalInstallments);
    const nextPayment: DebtPayment = {
      id: createRuntimeId("debt-payment"),
      ...input,
      amount,
      principal,
      interest,
    };

    setDebtPayments((current) => [nextPayment, ...current]);
    setDebts((current) => current.map((item) => item.id === debt.id ? {
      ...item,
      currentBalance: nextBalance,
      paidInstallments: nextPaidInstallments,
      nextDueDate: installmentCompleted && nextBalance > 0
        ? addMonthsToDate(item.nextDueDate, 1)
        : item.nextDueDate,
      status: nextBalance <= 0 ? "paid" : "active",
      installmentPayments: {
        ...(item.installmentPayments ?? {}),
        [installmentDate]: {
          paidAmount: nextInstallmentPaid,
          paidAt: installmentCompleted ? input.date : storedInstallment?.paidAt,
          accountId: input.accountId,
        },
      },
    } : item));

    appendAccountingEntry({
      direction: "expense",
      amount,
      accountId: input.accountId,
      date: input.date,
      description: `${financialIntelligenceContent.accounting.debtPaymentTitle} · ${debt.name}`,
      category: financialIntelligenceContent.accounting.debtsCategory,
      paymentMethod: financialIntelligenceContent.accounting.debtPaymentMethod,
      sourceType: "debt",
      sourceId: `${debt.id}::${nextPayment.id}`,
    });

    return { settled: nextBalance <= 0, amount };
  }

  function completeCalendarEvent(event: UnifiedCalendarEvent): boolean {
    if (event.sourceType === "manual" || !event.generated) {
      setManualCalendarEvents((current) => current.map((item) => item.id === event.id
        ? { ...item, status: "completed" }
        : item));
      return true;
    }

    if (event.sourceType === "receivable" && event.sourceRecordId) {
      recordReceivableReceipt({
        receivableId: event.sourceRecordId,
        amount: event.amount,
        receivedDate: referenceDate,
        accountId: event.accountId ?? "",
      });
      return true;
    }

    if (event.sourceRecordId) {
      const commitment = unifiedPayables.find((item) => item.id === event.sourceRecordId);
      if (commitment) {
        recordCommitmentPayment(commitment, {
          payableId: commitment.id,
          amount: Math.max(commitment.amount - commitment.paidAmount, 0),
          paymentDate: referenceDate,
          accountId: event.accountId ?? commitment.accountId,
        });
        return true;
      }
    }

    if (event.sourceType === "subscription" && event.sourceRecordId) {
      const subscription = subscriptions.find((item) => item.id === event.sourceRecordId);
      if (subscription) {
        recordSubscriptionCharge({
          subscriptionId: subscription.id,
          date: event.date,
          amount: event.amount || subscription.amount,
          accountId: event.accountId ?? subscription.accountId,
          status: "paid",
          note: financialIntelligenceContent.accounting.calendarPaymentNote,
        });
        return true;
      }
    }

    return false;
  }

  return {
    referenceDate,
    accounts,
    setAccounts,
    accountMovements,
    setAccountMovements,
    transactions,
    setTransactions,
    payables,
    setPayables,
    receivables,
    setReceivables,
    cards,
    setCards,
    invoices,
    setInvoices,
    cardPurchases,
    setCardPurchases,
    installmentPlans,
    setInstallmentPlans,
    subscriptions,
    setSubscriptions,
    subscriptionCharges,
    setSubscriptionCharges,
    debts,
    setDebts,
    debtPayments,
    setDebtPayments,
    manualCalendarEvents,
    setManualCalendarEvents,
    unifiedPayables,
    calendarEvents,
    operationalDebts,
    accountNames,
    recordManualTransaction,
    removeManualTransaction,
    recordCommitmentPayment,
    recordInvoicePayment,
    recordReceivableReceipt,
    recordSubscriptionCharge,
    recordDebtPayment,
    completeCalendarEvent,
  };
}
