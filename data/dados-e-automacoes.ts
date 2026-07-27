import { getReferenceDate } from "@/lib/reference-date";
import type { AutomationRule, ImportHistoryItem } from "@/types/dados-e-automacoes";

export const dataToolsReferenceDate = getReferenceDate();
export const initialAutomationRules: AutomationRule[] = [];
export const initialImportHistory: ImportHistoryItem[] = [];
