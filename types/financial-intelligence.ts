import type { FinancialCalendarEvent } from "@/types/calendario";
import type { Payable } from "@/types/contas-a-pagar";

export type CommitmentSource =
  | "manual-payable"
  | "card-invoice"
  | "subscription"
  | "debt-installment";

export type UnifiedPayable = Payable & {
  sourceType: CommitmentSource;
  sourceRecordId: string;
  sourceLabel: string;
  occurrenceDate: string;
  generated: boolean;
};

export type UnifiedCalendarEvent = FinancialCalendarEvent & {
  sourceType?: CommitmentSource | "receivable" | "manual";
  sourceRecordId?: string;
  sourceLabel?: string;
  generated?: boolean;
};
