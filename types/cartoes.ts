export type CardBrand = "visa" | "mastercard" | "elo";

export type CardStyle = "graphite" | "stone" | "plum";

export type CardStatus = "active" | "blocked";

export type InvoiceStatus = "open" | "closed" | "paid";

export type CreditCard = {
  id: string;
  name: string;
  institution: string;
  lastFourDigits: string;
  brand: CardBrand;
  style: CardStyle;
  limit: number;
  usedLimit: number;
  closingDay: number;
  dueDay: number;
  paymentAccountId: string;
  status: CardStatus;
  isPrimary?: boolean;
  createdAt: string;
};

export type CardInvoice = {
  id: string;
  cardId: string;
  reference: string;
  referenceLabel: string;
  closingDate: string;
  dueDate: string;
  amount: number;
  status: InvoiceStatus;
  paidAmount?: number;
  paymentDate?: string;
};

export type CardPurchase = {
  id: string;
  cardId: string;
  invoiceId: string;
  description: string;
  category: string;
  date: string;
  totalAmount: number;
  installmentAmount: number;
  currentInstallment: number;
  installments: number;
};

export type InstallmentPlan = {
  id: string;
  cardId: string;
  description: string;
  category: string;
  totalAmount: number;
  installmentAmount: number;
  paidInstallments: number;
  totalInstallments: number;
  nextChargeDate: string;
};

export type NewCardInput = {
  name: string;
  institution: string;
  lastFourDigits: string;
  brand: CardBrand;
  style: CardStyle;
  limit: number;
  closingDay: number;
  dueDay: number;
  paymentAccountId: string;
};

export type NewCardPurchaseInput = {
  cardId: string;
  description: string;
  category: string;
  date: string;
  amount: number;
  installments: number;
};

export type InvoicePaymentInput = {
  invoiceId: string;
  accountId: string;
  paymentDate: string;
};
