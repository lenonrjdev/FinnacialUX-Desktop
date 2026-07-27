export type AccountType =
  | "checking"
  | "digital"
  | "savings"
  | "cash"
  | "investment";

export type AccountGroup = "bank" | "wallet" | "reserve";

export type AccountIconName = "bank" | "wallet" | "savings" | "investment";

export type AccountFilter = "all" | AccountGroup;

export type AccountMovementType = "income" | "expense" | "transfer";

export type FinancialAccount = {
  id: string;
  name: string;
  institution: string;
  type: AccountType;
  group: AccountGroup;
  icon: AccountIconName;
  balance: number;
  projectedBalance: number;
  isPrimary?: boolean;
  includeInTotal: boolean;
  createdAt: string;
};

export type AccountMovement = {
  id: string;
  accountId: string;
  destinationAccountId?: string;
  description: string;
  category: string;
  date: string;
  amount: number;
  type: AccountMovementType;
  sourceType?: string;
  sourceId?: string;
};

export type NewAccountInput = {
  name: string;
  institution: string;
  type: AccountType;
  group: AccountGroup;
  icon: AccountIconName;
  initialBalance: number;
  includeInTotal: boolean;
};

export type AccountTransferInput = {
  sourceAccountId: string;
  destinationAccountId: string;
  amount: number;
  date: string;
  description: string;
};
