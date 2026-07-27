"use client";

import { useEffect, useMemo, useState } from "react";
import { DebtDetailsPanel } from "@/components/dividas/debt-details-panel";
import { DebtDialog } from "@/components/dividas/debt-dialog";
import { DebtPaymentDialog } from "@/components/dividas/debt-payment-dialog";
import { DebtPaymentsList } from "@/components/dividas/debt-payments-list";
import { DebtStrategyPanel } from "@/components/dividas/debt-strategy-panel";
import { DebtsHeading } from "@/components/dividas/debts-heading";
import { DebtsList } from "@/components/dividas/debts-list";
import { DebtsSummary } from "@/components/dividas/debts-summary";
import { DebtsToolbar } from "@/components/dividas/debts-toolbar";
import { PayoffSimulator } from "@/components/dividas/payoff-simulator";
import { CheckIcon } from "@/components/shared/icons";
import { debtsContent } from "@/content/dividas";
import { financialIntelligenceContent } from "@/content/financial-intelligence";
import { addMonthsToDate } from "@/lib/financial-intelligence";
import { formatSearchDate, matchesSearch } from "@/lib/search";
import { useFinancialIntelligence } from "@/lib/use-financial-intelligence";
import type {
  DebtFormInput,
  DebtPaymentInput,
  DebtPriorityFilter,
  DebtRow,
  DebtStatusFilter,
  DebtTypeFilter,
  DebtView,
  FinancialDebt,
} from "@/types/dividas";

function computeDebt(debt: FinancialDebt, referenceDate: string): DebtRow {
  const currentBalance = Math.max(debt.currentBalance, 0);
  const remainingInstallments = Math.max(debt.totalInstallments - debt.paidInstallments, 0);
  const progress = debt.originalAmount > 0
    ? ((debt.originalAmount - currentBalance) / debt.originalAmount) * 100
    : 0;
  const paidPrincipal = Math.max(debt.originalAmount - currentBalance, 0);
  const estimatedRemainingInterest = Math.max(
    debt.installmentAmount * remainingInstallments - currentBalance,
    0,
  );
  let computedStatus = debt.status;

  if (currentBalance <= 0 || debt.paidInstallments >= debt.totalInstallments) computedStatus = "paid";
  else if (debt.nextDueDate < referenceDate && debt.status !== "renegotiated") computedStatus = "overdue";

  return {
    ...debt,
    currentBalance,
    remainingInstallments,
    progress,
    paidPrincipal,
    estimatedRemainingInterest,
    computedStatus,
  };
}

function formatDebtFreeDate(referenceDate: string, months: number): string {
  const date = new Date(`${addMonthsToDate(referenceDate, months)}T12:00:00Z`);
  return new Intl.DateTimeFormat("pt-BR", {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

export default function DividasView() {
  const {
    referenceDate,
    accounts: storedAccounts,
    accountNames,
    debts,
    setDebts,
    debtPayments,
    transactions,
    operationalDebts,
    unifiedPayables,
    recordDebtPayment,
    recordCommitmentPayment,
  } = useFinancialIntelligence();
  const accounts = useMemo(
    () => storedAccounts.map((account) => ({ id: account.id, name: account.name })),
    [storedAccounts],
  );
  const [view, setView] = useState<DebtView>("debts");
  const [search, setSearch] = useState("");
  const [type, setType] = useState<DebtTypeFilter>("all");
  const [status, setStatus] = useState<DebtStatusFilter>("all");
  const [priority, setPriority] = useState<DebtPriorityFilter>("all");
  const [selectedDebtId, setSelectedDebtId] = useState("");
  const [editingDebt, setEditingDebt] = useState<FinancialDebt | null>(null);
  const [debtDialogOpen, setDebtDialogOpen] = useState(false);
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [paymentDebtId, setPaymentDebtId] = useState<string | undefined>();
  const [settleMode, setSettleMode] = useState(false);
  const [feedback, setFeedback] = useState("");

  const allDebts = useMemo(() => {
    const items = new Map<string, FinancialDebt>();
    [...debts, ...operationalDebts].forEach((debt) => items.set(debt.id, debt));
    return Array.from(items.values());
  }, [debts, operationalDebts]);

  useEffect(() => {
    if (!selectedDebtId && allDebts[0]) setSelectedDebtId(allDebts[0].id);
    if (selectedDebtId && !allDebts.some((debt) => debt.id === selectedDebtId)) {
      setSelectedDebtId(allDebts[0]?.id ?? "");
    }
  }, [allDebts, selectedDebtId]);

  const debtRows = useMemo(
    () => allDebts.map((debt) => computeDebt(debt, referenceDate)),
    [allDebts, referenceDate],
  );
  const filteredDebts = useMemo(() => debtRows.filter((debt) => {
    const matchesQuery = matchesSearch(search, [
      debt.name,
      debt.creditor,
      debt.notes,
      accountNames[debt.accountId],
      debt.currentBalance,
      debt.originalAmount,
      debt.installmentAmount,
      debt.nextDueDate,
      formatSearchDate(debt.nextDueDate),
      debtsContent.types[debt.type],
      debtsContent.statuses[debt.computedStatus],
      debtsContent.priorities[debt.priority],
      debt.generated ? financialIntelligenceContent.debts.automatic : "",
    ]);
    const matchesType = type === "all" || debt.type === type;
    const matchesStatus = status === "all" || debt.computedStatus === status;
    const matchesPriority = priority === "all" || debt.priority === priority;
    return matchesQuery && matchesType && matchesStatus && matchesPriority;
  }), [accountNames, debtRows, priority, search, status, type]);

  const filteredIds = useMemo(
    () => new Set(filteredDebts.filter((debt) => !debt.generated).map((debt) => debt.id)),
    [filteredDebts],
  );
  const filteredPayments = useMemo(() => debtPayments
    .filter((payment) => filteredIds.has(payment.debtId))
    .sort((a, b) => b.date.localeCompare(a.date)), [debtPayments, filteredIds]);

  const selectedDebt = debtRows.find((debt) => debt.id === selectedDebtId) ?? debtRows[0];
  const activeDebts = debtRows.filter((debt) => debt.computedStatus !== "paid");
  const summary = useMemo(() => {
    const outstanding = activeDebts.reduce((total, debt) => total + debt.currentBalance, 0);
    const monthly = activeDebts.reduce((total, debt) => total + debt.installmentAmount, 0);
    const overdue = activeDebts
      .filter((debt) => debt.computedStatus === "overdue")
      .reduce((total, debt) => total + Math.min(debt.installmentAmount, debt.currentBalance), 0);
    const interest = activeDebts.reduce(
      (total, debt) => total + debt.estimatedRemainingInterest,
      0,
    );
    const maxMonths = activeDebts.reduce(
      (maximum, debt) => Math.max(maximum, debt.remainingInstallments),
      0,
    );
    const currentMonth = referenceDate.slice(0, 7);
    const currentMonthIncome = transactions
      .filter((transaction) => (
        transaction.type === "income"
        && transaction.status === "completed"
        && transaction.date.startsWith(currentMonth)
      ))
      .reduce((total, transaction) => total + transaction.amount, 0);
    return {
      outstanding,
      monthly,
      overdue,
      interest,
      activeCount: activeDebts.length,
      debtToIncome: currentMonthIncome > 0 ? (monthly / currentMonthIncome) * 100 : 0,
      debtFreeLabel: formatDebtFreeDate(referenceDate, maxMonths),
    };
  }, [activeDebts, referenceDate, transactions]);

  function showFeedback(message: string) {
    setFeedback(message);
    window.setTimeout(() => setFeedback(""), 2600);
  }

  function openNewDebt() {
    setEditingDebt(null);
    setDebtDialogOpen(true);
  }

  function openEditDebt(debt: DebtRow) {
    if (debt.generated) {
      showFeedback(financialIntelligenceContent.debts.editBlocked);
      return;
    }
    setEditingDebt(debts.find((item) => item.id === debt.id) ?? null);
    setDebtDialogOpen(true);
  }

  function openPayment(debtId?: string, settle = false) {
    setPaymentDebtId(debtId ?? selectedDebt?.id);
    setSettleMode(settle);
    setPaymentDialogOpen(true);
  }

  function submitDebt(input: DebtFormInput) {
    if (editingDebt) {
      setDebts((current) => current.map((debt) => debt.id === editingDebt.id
        ? { ...debt, ...input, origin: "manual", generated: false }
        : debt));
      showFeedback(debtsContent.debtDialog.successEdit);
    } else {
      const nextDebt: FinancialDebt = {
        id: `debt-${Date.now()}`,
        ...input,
        createdAt: referenceDate,
        origin: "manual",
        generated: false,
      };
      setDebts((current) => [...current, nextDebt]);
      setSelectedDebtId(nextDebt.id);
      showFeedback(debtsContent.debtDialog.successCreate);
    }
    setDebtDialogOpen(false);
    setEditingDebt(null);
  }

  function submitPayment(input: DebtPaymentInput) {
    const debt = debtRows.find((item) => item.id === input.debtId);
    if (!debt) return;

    if (debt.generated && debt.originCommitmentId) {
      const commitment = unifiedPayables.find((item) => item.id === debt.originCommitmentId);
      if (!commitment) return;
      const result = recordCommitmentPayment(commitment, {
        payableId: commitment.id,
        amount: input.amount,
        paymentDate: input.date,
        accountId: input.accountId,
      });
      if (!result.amount) return;
      setPaymentDialogOpen(false);
      setSettleMode(false);
      showFeedback(financialIntelligenceContent.feedback.paymentSaved);
      return;
    }

    const result = recordDebtPayment(input);
    if (!result.amount) return;
    setSelectedDebtId(debt.id);
    setPaymentDialogOpen(false);
    setSettleMode(false);
    showFeedback(result.settled ? debtsContent.paymentDialog.settled : debtsContent.paymentDialog.success);
  }

  function selectById(id: string) {
    setSelectedDebtId(id);
    setView("debts");
  }

  return (
    <div className="financial-management-page debts-page">
      <DebtsHeading onNewDebt={openNewDebt} onNewPayment={() => openPayment()} />
      <DebtsSummary {...summary} />
      <DebtsToolbar
        view={view}
        search={search}
        type={type}
        status={status}
        priority={priority}
        onViewChange={setView}
        onSearchChange={setSearch}
        onTypeChange={setType}
        onStatusChange={setStatus}
        onPriorityChange={setPriority}
        onClear={() => {
          setSearch("");
          setType("all");
          setStatus("all");
          setPriority("all");
        }}
      />

      {view === "debts" ? (
        <div className="debts-workspace-grid">
          <DebtsList
            debts={filteredDebts}
            accountNames={accountNames}
            selectedId={selectedDebtId}
            onSelect={(debt) => setSelectedDebtId(debt.id)}
            onPay={(debt) => openPayment(debt.id)}
            onEdit={openEditDebt}
            onSettle={(debt) => openPayment(debt.id, true)}
          />
          <div className="debts-insight-column">
            <DebtDetailsPanel
              debt={selectedDebt}
              accountName={selectedDebt ? accountNames[selectedDebt.accountId] : undefined}
            />
            <PayoffSimulator debts={activeDebts} selectedId={selectedDebtId} onSelect={selectById} />
            <DebtStrategyPanel debts={debtRows} onSelect={selectById} />
          </div>
        </div>
      ) : (
        <DebtPaymentsList
          payments={filteredPayments}
          debts={debtRows}
          accountNames={accountNames}
        />
      )}

      {debtDialogOpen ? (
        <DebtDialog
          editing={editingDebt}
          accounts={accounts}
          onClose={() => {
            setDebtDialogOpen(false);
            setEditingDebt(null);
          }}
          onSubmit={submitDebt}
        />
      ) : null}
      {paymentDialogOpen ? (
        <DebtPaymentDialog
          debts={debtRows}
          accounts={accounts}
          initialDebtId={paymentDebtId}
          settle={settleMode}
          referenceDate={referenceDate}
          onClose={() => {
            setPaymentDialogOpen(false);
            setSettleMode(false);
          }}
          onSubmit={submitPayment}
        />
      ) : null}
      {feedback ? <div className="transaction-feedback"><CheckIcon /> {feedback}</div> : null}
    </div>
  );
}
