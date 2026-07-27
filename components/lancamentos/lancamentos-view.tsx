"use client";

import { useEffect, useMemo, useState } from "react";
import { NewTransactionDialog } from "@/components/lancamentos/new-transaction-dialog";
import {
  TransactionsFilters,
  type TransactionsFilterState,
} from "@/components/lancamentos/transactions-filters";
import { TransactionsHeading } from "@/components/lancamentos/transactions-heading";
import { TransactionsList } from "@/components/lancamentos/transactions-list";
import { TransactionsSummary } from "@/components/lancamentos/transactions-summary";
import { CheckIcon } from "@/components/shared/icons";
import { transactionsContent } from "@/content/lancamentos";
import { financialIntelligenceContent } from "@/content/financial-intelligence";
import { getReferenceDate, getReferenceMonth } from "@/lib/reference-date";
import { formatSearchDate, matchesSearch } from "@/lib/search";
import { useFinancialIntelligence } from "@/lib/use-financial-intelligence";
import type {
  FinancialTransaction,
  NewTransactionInput,
} from "@/types/lancamentos";

const defaultFilters: TransactionsFilterState = {
  query: "",
  type: "all",
  period: "all",
  status: "all",
  account: "all",
};

export default function LancamentosView() {
  const {
    transactions,
    accounts: financialAccounts,
    recordManualTransaction,
    removeManualTransaction,
  } = useFinancialIntelligence();
  const [filters, setFilters] = useState(defaultFilters);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState("");

  useEffect(() => {
    if (window.location.hash === "#novo-lancamento") {
      setDialogOpen(true);
      window.history.replaceState(null, "", window.location.pathname);
    }
  }, []);

  const summary = useMemo(() => {
    const currentMonthTransactions = transactions.filter((transaction) =>
      transaction.date.startsWith(getReferenceMonth()),
    );
    const completed = currentMonthTransactions.filter(
      (transaction) => transaction.status === "completed",
    );
    const income = completed
      .filter((transaction) => transaction.type === "income")
      .reduce((total, transaction) => total + transaction.amount, 0);
    const expense = completed
      .filter((transaction) => transaction.type === "expense")
      .reduce((total, transaction) => total + transaction.amount, 0);
    const pendingTransactions = transactions.filter(
      (transaction) => transaction.status !== "completed",
    );

    return {
      income,
      expense,
      result: income - expense,
      pending: pendingTransactions.reduce(
        (total, transaction) => total + transaction.amount,
        0,
      ),
      pendingCount: pendingTransactions.length,
    };
  }, [transactions]);

  const accountOptions = useMemo(
    () => financialAccounts.map((account) => account.name),
    [financialAccounts],
  );
  const filterAccounts = useMemo(
    () => Array.from(new Set([
      ...accountOptions,
      ...transactions.flatMap((transaction) => [
        transaction.account,
        ...(transaction.destinationAccount ? [transaction.destinationAccount] : []),
      ]),
    ])).filter(Boolean).sort((a, b) => a.localeCompare(b, "pt-BR")),
    [accountOptions, transactions],
  );

  const filteredTransactions = useMemo(() => {
    const referenceDate = new Date(`${getReferenceDate()}T12:00:00-03:00`);
    referenceDate.setDate(referenceDate.getDate() - 30);
    const lastThirtyDaysStart = getReferenceDate(referenceDate);

    return transactions
      .filter((transaction) => {
        const matchesQuery = matchesSearch(filters.query, [
          transaction.description,
          transaction.category,
          transaction.account,
          transaction.destinationAccount,
          transaction.paymentMethod,
          transaction.note,
          transaction.amount,
          transaction.date,
          formatSearchDate(transaction.date),
          transactionsContent.types[transaction.type],
          transactionsContent.statuses[transaction.status],
        ]);
        if (!matchesQuery) return false;
        if (filters.type !== "all" && transaction.type !== filters.type) return false;
        if (filters.status !== "all" && transaction.status !== filters.status) return false;
        if (
          filters.account !== "all"
          && transaction.account !== filters.account
          && transaction.destinationAccount !== filters.account
        ) return false;
        if (
          filters.period === "current-month"
          && !transaction.date.startsWith(getReferenceMonth())
        ) return false;
        if (
          filters.period === "last-30-days"
          && transaction.date < lastThirtyDaysStart
        ) return false;
        return true;
      })
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [filters, transactions]);

  function showFeedback(message: string) {
    setFeedbackMessage(message);
    window.setTimeout(() => setFeedbackMessage(""), 2800);
  }

  function createTransaction(input: NewTransactionInput) {
    recordManualTransaction(input);
    showFeedback(financialIntelligenceContent.feedback.transactionSaved);
  }

  function duplicateTransaction(transaction: FinancialTransaction) {
    const duplicate: NewTransactionInput = {
      description: `${transaction.description} (cópia)`,
      category: transaction.category,
      account: transaction.account,
      destinationAccount: transaction.destinationAccount,
      paymentMethod: transaction.paymentMethod,
      date: transaction.date,
      amount: transaction.amount,
      type: transaction.type,
      status: transaction.status,
      note: transaction.note,
    };
    recordManualTransaction(duplicate);
    showFeedback(transactionsContent.dialog.duplicateSuccess);
  }

  function deleteTransaction(transactionId: string) {
    const transaction = transactions.find((item) => item.id === transactionId);
    if (transaction?.sourceType && transaction.sourceType !== "manual-transaction") {
      showFeedback(financialIntelligenceContent.feedback.automaticTransactionProtected);
      return;
    }
    if (!removeManualTransaction(transactionId)) return;
    showFeedback(financialIntelligenceContent.feedback.transactionRemoved);
  }

  function exportTransactions() {
    const columns = [
      "Descrição",
      "Tipo",
      "Categoria",
      "Conta",
      "Conta de destino",
      "Forma de pagamento",
      "Data",
      "Status",
      "Valor",
    ];
    const escapeCell = (value: string | number) =>
      `"${String(value).replaceAll('"', '""')}"`;
    const rows = filteredTransactions.map((transaction) =>
      [
        transaction.description,
        transactionsContent.types[transaction.type],
        transaction.category,
        transaction.account,
        transaction.destinationAccount ?? "",
        transaction.paymentMethod,
        transaction.date,
        transactionsContent.statuses[transaction.status],
        transaction.amount.toFixed(2).replace(".", ","),
      ].map(escapeCell).join(";"),
    );
    const csv = `\uFEFF${columns.map(escapeCell).join(";")}\n${rows.join("\n")}`;
    const url = URL.createObjectURL(
      new Blob([csv], { type: "text/csv;charset=utf-8" }),
    );
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "lancamentos-financeiros.csv";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
    showFeedback(transactionsContent.dialog.exportSuccess);
  }

  return (
    <div className="transactions-page">
      <TransactionsHeading
        onCreate={() => setDialogOpen(true)}
        onExport={exportTransactions}
      />
      <TransactionsSummary values={summary} />
      <TransactionsFilters
        filters={filters}
        accounts={filterAccounts}
        onChange={setFilters}
        onClear={() => setFilters(defaultFilters)}
      />
      <TransactionsList
        transactions={filteredTransactions}
        onDuplicate={duplicateTransaction}
        onDelete={deleteTransaction}
      />

      <NewTransactionDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        accounts={accountOptions}
        onCreate={createTransaction}
      />

      {feedbackMessage ? (
        <div className="transaction-feedback" role="status">
          <CheckIcon />
          {feedbackMessage}
        </div>
      ) : null}
    </div>
  );
}
