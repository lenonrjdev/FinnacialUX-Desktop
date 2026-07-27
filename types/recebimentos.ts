export type ReceivableStatus = "pending" | "overdue" | "partial" | "received";

export type ReceivableRecurrence = "none" | "weekly" | "monthly" | "yearly";

export type Receivable = {
  id: string;
  description: string;
  source: string;
  payer?: string;
  category: string;
  amount: number;
  receivedAmount: number;
  expectedDate: string;
  accountId: string;
  status: ReceivableStatus;
  recurrence: ReceivableRecurrence;
  notes?: string;
  createdAt: string;
  receivedAt?: string;
};

export type NewReceivableInput = {
  description: string;
  source: string;
  payer?: string;
  category: string;
  amount: number;
  expectedDate: string;
  accountId: string;
  recurrence: ReceivableRecurrence;
  notes?: string;
};

export type ReceivableReceiptInput = {
  receivableId: string;
  amount: number;
  receivedDate: string;
  accountId: string;
};

export type ReceivableFilters = {
  search: string;
  status: "all" | ReceivableStatus;
  period: "all" | "today" | "seven-days" | "month" | "overdue";
  category: "all" | string;
  accountId: "all" | string;
};
