export type PayableStatus = "pending" | "overdue" | "partial" | "paid";

export type PayableRecurrence = "none" | "weekly" | "monthly" | "yearly";

export type PayableValueType = "fixed" | "variable";

export type PayableOccurrencePayment = {
  paidAmount: number;
  paidAt?: string;
  accountId?: string;
};

export type Payable = {
  id: string;
  description: string;
  category: string;
  amount: number;
  paidAmount: number;
  dueDate: string;
  accountId: string;
  status: PayableStatus;
  recurrence: PayableRecurrence;
  valueType: PayableValueType;
  notes?: string;
  createdAt: string;
  paidAt?: string;
  occurrencePayments?: Record<string, PayableOccurrencePayment>;
};

export type NewPayableInput = {
  description: string;
  category: string;
  amount: number;
  dueDate: string;
  accountId: string;
  recurrence: PayableRecurrence;
  valueType: PayableValueType;
  notes?: string;
};

export type PayablePaymentInput = {
  payableId: string;
  amount: number;
  paymentDate: string;
  accountId: string;
};

export type PayableFilters = {
  search: string;
  status: "all" | PayableStatus;
  period: "all" | "today" | "seven-days" | "month" | "overdue";
  category: "all" | string;
  accountId: "all" | string;
};
