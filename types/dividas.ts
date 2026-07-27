export type DebtType =
  | "personal-loan"
  | "financing"
  | "credit-card-installment"
  | "family-debt"
  | "overdraft"
  | "other";

export type DebtStatus = "active" | "overdue" | "paid" | "renegotiated";
export type DebtPriority = "high" | "medium" | "low";
export type DebtView = "debts" | "payments";
export type DebtStrategy = "avalanche" | "snowball";
export type DebtTypeFilter = "all" | DebtType;
export type DebtStatusFilter = "all" | DebtStatus;
export type DebtPriorityFilter = "all" | DebtPriority;

export interface DebtInstallmentPayment {
  paidAmount: number;
  paidAt?: string;
  accountId?: string;
}

export interface FinancialDebt {
  id: string;
  name: string;
  creditor: string;
  type: DebtType;
  originalAmount: number;
  currentBalance: number;
  annualInterestRate: number;
  totalInstallments: number;
  paidInstallments: number;
  installmentAmount: number;
  nextDueDate: string;
  startDate: string;
  accountId: string;
  status: DebtStatus;
  priority: DebtPriority;
  notes: string;
  createdAt: string;
  origin?: "manual" | "payable" | "card-invoice" | "subscription";
  originCommitmentId?: string;
  generated?: boolean;
  installmentPayments?: Record<string, DebtInstallmentPayment>;
}

export interface DebtPayment {
  id: string;
  debtId: string;
  date: string;
  amount: number;
  principal: number;
  interest: number;
  accountId: string;
  note: string;
}

export type DebtFormInput = Omit<FinancialDebt, "id" | "createdAt">;

export interface DebtPaymentInput {
  debtId: string;
  date: string;
  amount: number;
  accountId: string;
  note: string;
}

export interface DebtRow extends FinancialDebt {
  remainingInstallments: number;
  progress: number;
  paidPrincipal: number;
  estimatedRemainingInterest: number;
  computedStatus: DebtStatus;
}

export interface PayoffSimulation {
  currentMonths: number;
  simulatedMonths: number;
  monthsSaved: number;
  currentInterest: number;
  simulatedInterest: number;
  interestSaved: number;
  newMonthlyPayment: number;
}
