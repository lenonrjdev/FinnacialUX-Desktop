"use client";

import { useMemo, useState } from "react";
import { AccountsPayableFilters } from "@/components/contas-a-pagar/accounts-payable-filters";
import { AccountsPayableHeading } from "@/components/contas-a-pagar/accounts-payable-heading";
import { AccountsPayableList } from "@/components/contas-a-pagar/accounts-payable-list";
import { AccountsPayableSummary } from "@/components/contas-a-pagar/accounts-payable-summary";
import { NewPayableDialog } from "@/components/contas-a-pagar/new-payable-dialog";
import { PayPayableDialog } from "@/components/contas-a-pagar/pay-payable-dialog";
import { PayablesInsightPanel } from "@/components/contas-a-pagar/payables-insight-panel";
import { CheckIcon } from "@/components/shared/icons";
import { payablesContent } from "@/content/contas-a-pagar";
import { financialIntelligenceContent } from "@/content/financial-intelligence";
import { addDaysToDate, endOfMonth } from "@/lib/financial-intelligence";
import { formatSearchDate, matchesSearch } from "@/lib/search";
import { useFinancialIntelligence } from "@/lib/use-financial-intelligence";
import type {
  NewPayableInput,
  Payable,
  PayableFilters,
  PayablePaymentInput,
} from "@/types/contas-a-pagar";

const initialFilters: PayableFilters = {
  search: "",
  status: "all",
  period: "all",
  category: "all",
  accountId: "all",
};

function createId(value: string): string {
  const slug = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
  return `${slug || "conta"}-${Date.now()}`;
}

export default function ContasAPagarView() {
  const {
    referenceDate,
    accounts,
    accountNames,
    payables,
    setPayables,
    unifiedPayables,
    recordCommitmentPayment,
  } = useFinancialIntelligence();
  const [filters, setFilters] = useState<PayableFilters>(initialFilters);
  const [newDialogOpen, setNewDialogOpen] = useState(false);
  const [paymentPayableId, setPaymentPayableId] = useState("");
  const [feedbackMessage, setFeedbackMessage] = useState("");

  const month = referenceDate.slice(0, 7);
  const monthEnd = endOfMonth(referenceDate);
  const sevenDaysLimit = addDaysToDate(referenceDate, 7);

  const summary = useMemo(() => {
    const currentCommitments = unifiedPayables.filter((item) => (
      item.status !== "paid"
      && item.dueDate <= monthEnd
    ));
    const pending = currentCommitments.reduce(
      (total, item) => total + Math.max(0, item.amount - item.paidAmount),
      0,
    );
    const dueToday = unifiedPayables
      .filter((item) => item.dueDate === referenceDate && item.status !== "paid")
      .reduce((total, item) => total + Math.max(0, item.amount - item.paidAmount), 0);
    const nextSevenDays = unifiedPayables
      .filter((item) => (
        item.dueDate >= referenceDate
        && item.dueDate <= sevenDaysLimit
        && item.status !== "paid"
      ))
      .reduce((total, item) => total + Math.max(0, item.amount - item.paidAmount), 0);
    const overdueItems = unifiedPayables.filter((item) => item.status === "overdue");
    const overdue = overdueItems.reduce(
      (total, item) => total + Math.max(0, item.amount - item.paidAmount),
      0,
    );
    const paidThisMonth = unifiedPayables
      .filter((item) => item.paidAt?.startsWith(month))
      .reduce((total, item) => total + item.paidAmount, 0);

    return {
      pending,
      dueToday,
      nextSevenDays,
      overdue,
      paidThisMonth,
      overdueCount: overdueItems.length,
    };
  }, [month, monthEnd, referenceDate, sevenDaysLimit, unifiedPayables]);

  const filteredPayables = useMemo(() => unifiedPayables.filter((item) => {
    const matchesQuery = matchesSearch(filters.search, [
      item.description,
      item.category,
      item.notes,
      item.sourceLabel,
      item.amount,
      item.paidAmount,
      item.dueDate,
      formatSearchDate(item.dueDate),
      accountNames[item.accountId],
      payablesContent.statuses[item.status],
      payablesContent.recurrences[item.recurrence],
      payablesContent.valueTypes[item.valueType],
      financialIntelligenceContent.sources[item.sourceType],
    ]);
    const matchesStatus = filters.status === "all" || item.status === filters.status;
    const matchesCategory = filters.category === "all" || item.category === filters.category;
    const matchesAccount = filters.accountId === "all" || item.accountId === filters.accountId;
    const matchesPeriod = filters.period === "all"
      || (filters.period === "today" && item.dueDate === referenceDate)
      || (filters.period === "seven-days" && item.dueDate >= referenceDate && item.dueDate <= sevenDaysLimit)
      || (filters.period === "month" && item.dueDate.startsWith(month))
      || (filters.period === "overdue" && item.status === "overdue");

    return matchesQuery && matchesStatus && matchesCategory && matchesAccount && matchesPeriod;
  }), [accountNames, filters, month, referenceDate, sevenDaysLimit, unifiedPayables]);

  const categories = useMemo(
    () => [...new Set(unifiedPayables.map((item) => item.category))]
      .sort((a, b) => a.localeCompare(b, "pt-BR")),
    [unifiedPayables],
  );
  const selectedPayable = unifiedPayables.find((item) => item.id === paymentPayableId);

  function showFeedback(message: string) {
    setFeedbackMessage(message);
    window.setTimeout(() => setFeedbackMessage(""), 2600);
  }

  function createPayable(input: NewPayableInput) {
    const payable: Payable = {
      id: createId(input.description),
      ...input,
      paidAmount: 0,
      status: input.dueDate < referenceDate ? "overdue" : "pending",
      createdAt: referenceDate,
    };
    setPayables((current) => [payable, ...current]);
    showFeedback(payablesContent.newDialog.success);
  }

  function registerPayment(input: PayablePaymentInput) {
    if (!selectedPayable) return;
    const result = recordCommitmentPayment(selectedPayable, input);
    if (!result.amount) return;
    showFeedback(
      result.paid
        ? financialIntelligenceContent.feedback.paymentSaved
        : payablesContent.paymentDialog.successPartial,
    );
  }

  return (
    <div className="financial-management-page">
      <AccountsPayableHeading onNew={() => setNewDialogOpen(true)} />
      <AccountsPayableSummary {...summary} />
      <AccountsPayableFilters
        filters={filters}
        categories={categories}
        accounts={accounts}
        onChange={setFilters}
      />

      <div className="commitment-workspace-grid">
        <AccountsPayableList
          payables={filteredPayables}
          accounts={accounts}
          onPay={setPaymentPayableId}
        />
        <PayablesInsightPanel payables={unifiedPayables} referenceDate={referenceDate} />
      </div>

      {newDialogOpen ? (
        <NewPayableDialog
          accounts={accounts}
          onClose={() => setNewDialogOpen(false)}
          onSubmit={createPayable}
        />
      ) : null}
      {selectedPayable ? (
        <PayPayableDialog
          payable={selectedPayable}
          accounts={accounts}
          onClose={() => setPaymentPayableId("")}
          onSubmit={registerPayment}
        />
      ) : null}

      {feedbackMessage ? (
        <div className="transaction-feedback"><CheckIcon /> {feedbackMessage}</div>
      ) : null}
    </div>
  );
}
