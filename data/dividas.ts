import { getReferenceDate } from "@/lib/reference-date";
import type { DebtPayment, FinancialDebt } from "@/types/dividas";

export const debtsReferenceDate = getReferenceDate();
export const monthlyIncomeReference = 0;
export const initialDebts: FinancialDebt[] = [];
export const initialDebtPayments: DebtPayment[] = [];
