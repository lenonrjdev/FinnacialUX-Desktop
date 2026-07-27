"use client";

import { useEffect, useMemo, useState } from "react";
import { ChargeDialog } from "@/components/assinaturas/charge-dialog";
import { ChargesList } from "@/components/assinaturas/charges-list";
import { SubscriptionDialog } from "@/components/assinaturas/subscription-dialog";
import { SubscriptionInsights } from "@/components/assinaturas/subscription-insights";
import { SubscriptionsHeading } from "@/components/assinaturas/subscriptions-heading";
import { SubscriptionsList } from "@/components/assinaturas/subscriptions-list";
import { SubscriptionsSummary } from "@/components/assinaturas/subscriptions-summary";
import { SubscriptionsToolbar } from "@/components/assinaturas/subscriptions-toolbar";
import { CheckIcon } from "@/components/shared/icons";
import { subscriptionsContent } from "@/content/assinaturas";
import { formatSearchDate, matchesSearch } from "@/lib/search";
import { useFinancialIntelligence } from "@/lib/use-financial-intelligence";
import type {
  BillingCycle,
  PersonalSubscription,
  SubscriptionAccountFilter,
  SubscriptionCategoryFilter,
  SubscriptionChargeInput,
  SubscriptionFormInput,
  SubscriptionRow,
  SubscriptionStatusFilter,
  SubscriptionView,
} from "@/types/assinaturas";

function monthlyEquivalent(amount: number, cycle: BillingCycle): number {
  const factor: Record<BillingCycle, number> = {
    weekly: 52 / 12,
    monthly: 1,
    quarterly: 1 / 3,
    semiannual: 1 / 6,
    annual: 1 / 12,
  };
  return amount * factor[cycle];
}

function annualEquivalent(amount: number, cycle: BillingCycle): number {
  const factor: Record<BillingCycle, number> = {
    weekly: 52,
    monthly: 12,
    quarterly: 4,
    semiannual: 2,
    annual: 1,
  };
  return amount * factor[cycle];
}

function differenceInDays(value: string, reference: string): number {
  const date = new Date(`${value}T12:00:00Z`).getTime();
  const base = new Date(`${reference}T12:00:00Z`).getTime();
  return Math.round((date - base) / 86400000);
}

function computeSubscription(
  subscription: PersonalSubscription,
  referenceDate: string,
): SubscriptionRow {
  const monthly = monthlyEquivalent(subscription.amount, subscription.billingCycle);
  const annual = annualEquivalent(subscription.amount, subscription.billingCycle);
  const daysUntilCharge = differenceInDays(subscription.nextChargeDate, referenceDate);
  const priceDifference = subscription.previousAmount
    ? Math.max(subscription.amount - subscription.previousAmount, 0)
    : 0;
  const priceChangePercentage = subscription.previousAmount && priceDifference > 0
    ? (priceDifference / subscription.previousAmount) * 100
    : 0;
  const inactive = subscription.status === "paused" || subscription.status === "cancelled";
  const computedChargeStatus = inactive
    ? "inactive"
    : daysUntilCharge < 0
      ? "overdue"
      : daysUntilCharge <= 30
        ? "upcoming"
        : "future";

  return {
    ...subscription,
    monthlyEquivalent: monthly,
    annualEquivalent: annual,
    daysUntilCharge,
    priceDifference,
    priceChangePercentage,
    computedChargeStatus,
  };
}

export default function AssinaturasView() {
  const {
    referenceDate,
    accounts: storedAccounts,
    accountNames,
    subscriptions,
    setSubscriptions,
    subscriptionCharges: charges,
    recordSubscriptionCharge,
  } = useFinancialIntelligence();
  const accounts = useMemo(
    () => storedAccounts.map((account) => ({ id: account.id, name: account.name })),
    [storedAccounts],
  );
  const [view, setView] = useState<SubscriptionView>("subscriptions");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<SubscriptionCategoryFilter>("all");
  const [status, setStatus] = useState<SubscriptionStatusFilter>("all");
  const [accountId, setAccountId] = useState<SubscriptionAccountFilter>("all");
  const [selectedId, setSelectedId] = useState("");
  const [editingSubscription, setEditingSubscription] = useState<PersonalSubscription | null>(null);
  const [subscriptionDialogOpen, setSubscriptionDialogOpen] = useState(false);
  const [chargeDialogOpen, setChargeDialogOpen] = useState(false);
  const [chargeSubscriptionId, setChargeSubscriptionId] = useState<string | undefined>();
  const [feedback, setFeedback] = useState("");

  useEffect(() => {
    if (!selectedId && subscriptions[0]) setSelectedId(subscriptions[0].id);
    if (selectedId && !subscriptions.some((subscription) => subscription.id === selectedId)) {
      setSelectedId(subscriptions[0]?.id ?? "");
    }
  }, [selectedId, subscriptions]);

  const subscriptionRows = useMemo(
    () => subscriptions.map((subscription) => computeSubscription(subscription, referenceDate)),
    [referenceDate, subscriptions],
  );
  const filteredSubscriptions = useMemo(() => subscriptionRows.filter((subscription) => {
    const matchesQuery = matchesSearch(search, [
      subscription.name,
      subscription.provider,
      subscription.notes,
      subscription.amount,
      subscription.nextChargeDate,
      formatSearchDate(subscription.nextChargeDate),
      subscriptionsContent.categories[subscription.category],
      subscriptionsContent.statuses[subscription.status],
      subscriptionsContent.billingCycles[subscription.billingCycle],
      accountNames[subscription.accountId],
      subscription.autoRenew ? "renovação automática" : "renovação manual",
    ]);
    const matchesCategory = category === "all" || subscription.category === category;
    const matchesStatus = status === "all" || subscription.status === status;
    const matchesAccount = accountId === "all" || subscription.accountId === accountId;
    return matchesQuery && matchesCategory && matchesStatus && matchesAccount;
  }), [accountId, accountNames, category, search, status, subscriptionRows]);

  const filteredIds = useMemo(
    () => new Set(filteredSubscriptions.map((item) => item.id)),
    [filteredSubscriptions],
  );
  const filteredCharges = useMemo(() => charges
    .filter((charge) => filteredIds.has(charge.subscriptionId))
    .sort((a, b) => b.date.localeCompare(a.date)), [charges, filteredIds]);
  const selected = subscriptionRows.find((item) => item.id === selectedId) ?? subscriptionRows[0];
  const activeSubscriptions = subscriptionRows.filter(
    (item) => item.status === "active" || item.status === "trial",
  );

  const summary = useMemo(() => {
    const monthly = activeSubscriptions.reduce((total, item) => total + item.monthlyEquivalent, 0);
    const annual = activeSubscriptions.reduce((total, item) => total + item.annualEquivalent, 0);
    const nextThirtyDays = activeSubscriptions
      .filter((item) => item.daysUntilCharge >= 0 && item.daysUntilCharge <= 30)
      .reduce((total, item) => total + item.amount, 0);
    const savings = activeSubscriptions
      .filter((item) => item.usage === "low" || item.status === "trial")
      .reduce((total, item) => total + item.monthlyEquivalent, 0);
    return {
      monthly,
      annual,
      nextThirtyDays,
      savings,
      activeCount: activeSubscriptions.length,
    };
  }, [activeSubscriptions]);

  function showFeedback(message: string) {
    setFeedback(message);
    window.setTimeout(() => setFeedback(""), 2600);
  }

  function openNewSubscription() {
    setEditingSubscription(null);
    setSubscriptionDialogOpen(true);
  }

  function openEditSubscription(subscription: SubscriptionRow) {
    setEditingSubscription(subscriptions.find((item) => item.id === subscription.id) ?? null);
    setSubscriptionDialogOpen(true);
  }

  function openCharge(subscriptionId?: string) {
    setChargeSubscriptionId(subscriptionId ?? selected?.id);
    setChargeDialogOpen(true);
  }

  function submitSubscription(input: SubscriptionFormInput) {
    if (editingSubscription) {
      setSubscriptions((current) => current.map((item) => item.id === editingSubscription.id
        ? { ...item, ...input }
        : item));
      showFeedback(subscriptionsContent.subscriptionDialog.successEdit);
    } else {
      const next: PersonalSubscription = {
        id: `subscription-${Date.now()}`,
        ...input,
        createdAt: referenceDate,
      };
      setSubscriptions((current) => [...current, next]);
      setSelectedId(next.id);
      showFeedback(subscriptionsContent.subscriptionDialog.successCreate);
    }
    setSubscriptionDialogOpen(false);
    setEditingSubscription(null);
  }

  function submitCharge(input: SubscriptionChargeInput) {
    if (!recordSubscriptionCharge(input)) return;
    setSelectedId(input.subscriptionId);
    setChargeDialogOpen(false);
    showFeedback(subscriptionsContent.chargeDialog.success);
  }

  function togglePause(subscription: SubscriptionRow) {
    const nextStatus = subscription.status === "paused" ? "active" : "paused";
    setSubscriptions((current) => current.map((item) => item.id === subscription.id
      ? { ...item, status: nextStatus }
      : item));
    showFeedback(nextStatus === "paused"
      ? subscriptionsContent.feedback.paused
      : subscriptionsContent.feedback.resumed);
  }

  function cancelSubscription(subscription: SubscriptionRow) {
    setSubscriptions((current) => current.map((item) => item.id === subscription.id
      ? { ...item, status: "cancelled", autoRenew: false }
      : item));
    showFeedback(subscriptionsContent.feedback.cancelled);
  }

  return (
    <div className="financial-management-page subscriptions-page">
      <SubscriptionsHeading onNewSubscription={openNewSubscription} onNewCharge={() => openCharge()} />
      <SubscriptionsSummary
        monthlyEquivalent={summary.monthly}
        annualEstimate={summary.annual}
        nextThirtyDays={summary.nextThirtyDays}
        activeCount={summary.activeCount}
        savingsPotential={summary.savings}
      />
      <SubscriptionsToolbar
        view={view}
        search={search}
        category={category}
        status={status}
        accountId={accountId}
        accounts={accounts}
        onViewChange={setView}
        onSearchChange={setSearch}
        onCategoryChange={setCategory}
        onStatusChange={setStatus}
        onAccountChange={setAccountId}
        onClear={() => {
          setSearch("");
          setCategory("all");
          setStatus("all");
          setAccountId("all");
        }}
      />

      {view === "subscriptions" ? (
        <div className="subscriptions-workspace-grid">
          <SubscriptionsList
            subscriptions={filteredSubscriptions}
            accountNames={accountNames}
            selectedId={selectedId}
            onSelect={(subscription) => setSelectedId(subscription.id)}
            onCharge={(subscription) => openCharge(subscription.id)}
            onEdit={openEditSubscription}
            onTogglePause={togglePause}
            onCancel={cancelSubscription}
          />
          <SubscriptionInsights subscriptions={subscriptionRows} selected={selected} />
        </div>
      ) : (
        <ChargesList
          charges={filteredCharges}
          subscriptions={subscriptions}
          accountNames={accountNames}
        />
      )}

      {subscriptionDialogOpen ? (
        <SubscriptionDialog
          key={editingSubscription?.id ?? "new-subscription"}
          editing={editingSubscription}
          accounts={accounts}
          referenceDate={referenceDate}
          onClose={() => {
            setSubscriptionDialogOpen(false);
            setEditingSubscription(null);
          }}
          onSubmit={submitSubscription}
        />
      ) : null}

      {chargeDialogOpen ? (
        <ChargeDialog
          key={`${chargeSubscriptionId ?? "charge"}-${chargeDialogOpen}`}
          subscriptions={subscriptionRows}
          accounts={accounts}
          initialSubscriptionId={chargeSubscriptionId}
          referenceDate={referenceDate}
          onClose={() => setChargeDialogOpen(false)}
          onSubmit={submitCharge}
        />
      ) : null}

      {feedback ? <div className="transaction-feedback"><CheckIcon />{feedback}</div> : null}
    </div>
  );
}
