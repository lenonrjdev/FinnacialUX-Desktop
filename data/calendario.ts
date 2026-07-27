import { getReferenceDate } from "@/lib/reference-date";
import type { FinancialCalendarEvent } from "@/types/calendario";

export const calendarReferenceDate = getReferenceDate();
export const initialCalendarEvents: FinancialCalendarEvent[] = [];
