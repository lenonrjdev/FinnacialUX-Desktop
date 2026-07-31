export type TransactionType = "income" | "expense" | "transfer";

export type TransactionStatus = "completed" | "pending" | "overdue";

export type TransactionPeriod = "current-month" | "last-30-days" | "all";

export type FinancialTransaction = {
  id: string;
  description: string;
  category: string;
  account: string;
  destinationAccount?: string;
  destinationAccountId?: string;
  paymentMethod: string;
  date: string;
  amount: number;
  type: TransactionType;
  status: TransactionStatus;
  note?: string;
  sourceType?: string;
  sourceId?: string;
  accountId?: string;
  reconciliationImportId?: string;
  reconciliationEntryId?: string;
  reconciliationStatus?: "matched" | "created";
  reconciledAt?: string;
};

export type NewTransactionInput = Omit<FinancialTransaction, "id">;
