import { getReferenceDate } from "@/lib/reference-date";
import type { AutomationRule, ImportHistoryItem } from "@/types/dados-e-automacoes";
import type { RecurringTransactionTemplate } from "@/types/desktop-automations";

export const dataToolsReferenceDate = getReferenceDate();
export const initialAutomationRules: AutomationRule[] = [];
export const initialImportHistory: ImportHistoryItem[] = [];
export const initialRecurringTemplates: RecurringTransactionTemplate[] = [];
