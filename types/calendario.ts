export type CalendarEventType =
  | "income"
  | "expense"
  | "invoice"
  | "transfer"
  | "goal"
  | "subscription";

export type CalendarEventStatus = "scheduled" | "overdue" | "completed";

export type CalendarEventRecurrence = "none" | "weekly" | "monthly" | "yearly";

export type CalendarEventSource =
  | "payable"
  | "receivable"
  | "invoice"
  | "subscription"
  | "debt"
  | "manual";

export type FinancialCalendarEvent = {
  id: string;
  title: string;
  type: CalendarEventType;
  status: CalendarEventStatus;
  amount: number;
  date: string;
  category: string;
  accountId?: string;
  recurrence: CalendarEventRecurrence;
  source: CalendarEventSource;
  notes?: string;
};

export type NewCalendarEventInput = {
  title: string;
  type: CalendarEventType;
  amount: number;
  date: string;
  category: string;
  accountId?: string;
  recurrence: CalendarEventRecurrence;
  notes?: string;
};

export type CalendarFilters = {
  search: string;
  type: "all" | CalendarEventType;
  status: "all" | CalendarEventStatus;
  accountId: "all" | string;
};

export type CalendarViewMode = "month" | "agenda";
