"use client";

import { useMemo, useState } from "react";
import { NewReceivableDialog } from "@/components/recebimentos/new-receivable-dialog";
import { ReceiveReceivableDialog } from "@/components/recebimentos/receive-receivable-dialog";
import { ReceivablesFilters } from "@/components/recebimentos/receivables-filters";
import { ReceivablesHeading } from "@/components/recebimentos/receivables-heading";
import { ReceivablesInsightPanel } from "@/components/recebimentos/receivables-insight-panel";
import { ReceivablesList } from "@/components/recebimentos/receivables-list";
import { ReceivablesSummary } from "@/components/recebimentos/receivables-summary";
import { CheckIcon } from "@/components/shared/icons";
import { receivablesContent } from "@/content/recebimentos";
import { financialIntelligenceContent } from "@/content/financial-intelligence";
import { addDaysToDate } from "@/lib/financial-intelligence";
import { formatSearchDate, matchesSearch } from "@/lib/search";
import { useFinancialIntelligence } from "@/lib/use-financial-intelligence";
import type {
  NewReceivableInput,
  Receivable,
  ReceivableFilters,
  ReceivableReceiptInput,
  ReceivableStatus,
} from "@/types/recebimentos";

const initialFilters: ReceivableFilters = {
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
  return `${slug || "recebimento"}-${Date.now()}`;
}

function getAutomaticStatus(item: Receivable, referenceDate: string): ReceivableStatus {
  if (item.receivedAmount >= item.amount - 0.001) return "received";
  if (item.receivedAmount > 0) return "partial";
  if (item.expectedDate < referenceDate) return "overdue";
  return "pending";
}

export default function RecebimentosView() {
  const {
    referenceDate,
    accounts,
    accountNames,
    receivables,
    setReceivables,
    recordReceivableReceipt,
  } = useFinancialIntelligence();
  const [filters, setFilters] = useState<ReceivableFilters>(initialFilters);
  const [newDialogOpen, setNewDialogOpen] = useState(false);
  const [receiptReceivableId, setReceiptReceivableId] = useState("");
  const [feedbackMessage, setFeedbackMessage] = useState("");

  const month = referenceDate.slice(0, 7);
  const sevenDaysLimit = addDaysToDate(referenceDate, 7);

  const normalizedReceivables = useMemo(
    () => receivables.map((item) => ({
      ...item,
      status: getAutomaticStatus(item, referenceDate),
    })),
    [receivables, referenceDate],
  );

  const summary = useMemo(() => {
    const received = normalizedReceivables
      .filter((item) => item.receivedAt?.startsWith(month) || (item.status === "partial" && item.receivedAmount > 0))
      .reduce((total, item) => total + item.receivedAmount, 0);
    const expected = normalizedReceivables
      .reduce((total, item) => total + Math.max(0, item.amount - item.receivedAmount), 0);
    const nextSevenDays = normalizedReceivables
      .filter((item) => (
        item.expectedDate >= referenceDate
        && item.expectedDate <= sevenDaysLimit
        && item.status !== "received"
      ))
      .reduce((total, item) => total + Math.max(0, item.amount - item.receivedAmount), 0);
    const overdueItems = normalizedReceivables.filter((item) => item.status === "overdue");
    const overdue = overdueItems
      .reduce((total, item) => total + Math.max(0, item.amount - item.receivedAmount), 0);
    const recurring = normalizedReceivables
      .filter((item) => item.recurrence !== "none")
      .reduce((total, item) => total + item.amount, 0);

    return {
      received,
      expected,
      nextSevenDays,
      overdue,
      recurring,
      overdueCount: overdueItems.length,
    };
  }, [month, normalizedReceivables, referenceDate, sevenDaysLimit]);

  const filteredReceivables = useMemo(() => normalizedReceivables
    .filter((item) => {
      const matchesQuery = matchesSearch(filters.search, [
        item.description,
        item.source,
        item.payer,
        item.category,
        item.notes,
        item.amount,
        item.receivedAmount,
        item.expectedDate,
        formatSearchDate(item.expectedDate),
        accountNames[item.accountId],
        receivablesContent.statuses[item.status],
        receivablesContent.recurrences[item.recurrence],
      ]);
      const matchesStatus = filters.status === "all" || item.status === filters.status;
      const matchesCategory = filters.category === "all" || item.category === filters.category;
      const matchesAccount = filters.accountId === "all" || item.accountId === filters.accountId;
      const matchesPeriod = filters.period === "all"
        || (filters.period === "today" && item.expectedDate === referenceDate)
        || (filters.period === "seven-days" && item.expectedDate >= referenceDate && item.expectedDate <= sevenDaysLimit)
        || (filters.period === "month" && item.expectedDate.startsWith(month))
        || (filters.period === "overdue" && item.status === "overdue");

      return matchesQuery && matchesStatus && matchesCategory && matchesAccount && matchesPeriod;
    })
    .sort((a, b) => {
      const statusOrder = { overdue: 0, pending: 1, partial: 2, received: 3 } as const;
      return statusOrder[a.status] - statusOrder[b.status]
        || a.expectedDate.localeCompare(b.expectedDate);
    }), [accountNames, filters, month, normalizedReceivables, referenceDate, sevenDaysLimit]);

  const categories = useMemo(
    () => [...new Set(normalizedReceivables.map((item) => item.category))]
      .sort((a, b) => a.localeCompare(b, "pt-BR")),
    [normalizedReceivables],
  );
  const selectedReceivable = normalizedReceivables.find(
    (item) => item.id === receiptReceivableId,
  );

  function showFeedback(message: string) {
    setFeedbackMessage(message);
    window.setTimeout(() => setFeedbackMessage(""), 2600);
  }

  function createReceivable(input: NewReceivableInput) {
    const receivable: Receivable = {
      id: createId(input.description),
      ...input,
      receivedAmount: 0,
      status: input.expectedDate < referenceDate ? "overdue" : "pending",
      createdAt: referenceDate,
    };
    setReceivables((current) => [receivable, ...current]);
    showFeedback(receivablesContent.newDialog.success);
  }

  function registerReceipt(input: ReceivableReceiptInput) {
    const result = recordReceivableReceipt(input);
    if (!result.amount) return;
    showFeedback(result.received
      ? financialIntelligenceContent.feedback.receiptSaved
      : receivablesContent.receiptDialog.successPartial);
  }

  return (
    <div className="financial-management-page">
      <ReceivablesHeading onNew={() => setNewDialogOpen(true)} />
      <ReceivablesSummary {...summary} />
      <ReceivablesFilters
        filters={filters}
        categories={categories}
        accounts={accounts}
        onChange={setFilters}
      />

      <div className="commitment-workspace-grid">
        <ReceivablesList
          receivables={filteredReceivables}
          accounts={accounts}
          onReceive={setReceiptReceivableId}
        />
        <ReceivablesInsightPanel receivables={normalizedReceivables} referenceDate={referenceDate} />
      </div>

      {newDialogOpen ? (
        <NewReceivableDialog
          accounts={accounts}
          onClose={() => setNewDialogOpen(false)}
          onSubmit={createReceivable}
        />
      ) : null}
      {selectedReceivable ? (
        <ReceiveReceivableDialog
          receivable={selectedReceivable}
          accounts={accounts}
          onClose={() => setReceiptReceivableId("")}
          onSubmit={registerReceipt}
        />
      ) : null}

      {feedbackMessage ? (
        <div className="transaction-feedback"><CheckIcon /> {feedbackMessage}</div>
      ) : null}
    </div>
  );
}
