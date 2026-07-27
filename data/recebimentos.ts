import { getReferenceDate } from "@/lib/reference-date";
import type { Receivable } from "@/types/recebimentos";

export const receivablesReferenceDate = getReferenceDate();
export const initialReceivables: Receivable[] = [];
