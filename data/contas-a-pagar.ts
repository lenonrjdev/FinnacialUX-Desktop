import { getReferenceDate } from "@/lib/reference-date";
import type { Payable } from "@/types/contas-a-pagar";

export const payablesReferenceDate = getReferenceDate();
export const initialPayables: Payable[] = [];
