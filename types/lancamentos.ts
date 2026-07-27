export type TransactionType = "income" | "expense" | "transfer";

export type TransactionStatus = "completed" | "pending" | "overdue";

export type TransactionPeriod = "current-month" | "last-30-days" | "all";

export type FinancialTransaction = {
  id: string;
  description: string;
  category: string;
  account: string;
  destinationAccount?: string;
  paymentMethod: string;
  date: string;
  amount: number;
  type: TransactionType;
  status: TransactionStatus;
  note?: string;
  sourceType?: string;
  sourceId?: string;
};

export type NewTransactionInput = Omit<FinancialTransaction, "id">;
