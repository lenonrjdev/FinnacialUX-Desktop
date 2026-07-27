"use client";

import { useMemo, useState } from "react";
import { CalendarAgendaList } from "@/components/calendario/calendar-agenda-list";
import { CalendarHeading } from "@/components/calendario/calendar-heading";
import { CalendarSummary } from "@/components/calendario/calendar-summary";
import { CalendarToolbar } from "@/components/calendario/calendar-toolbar";
import { DayAgenda } from "@/components/calendario/day-agenda";
import { MonthCalendar } from "@/components/calendario/month-calendar";
import { MonthProjection } from "@/components/calendario/month-projection";
import { NewCalendarEventDialog } from "@/components/calendario/new-calendar-event-dialog";
import { CheckIcon } from "@/components/shared/icons";
import { calendarContent } from "@/content/calendario";
import { getMonthKey, shiftMonth } from "@/lib/calendar";
import { formatSearchDate, matchesSearch } from "@/lib/search";
import { useFinancialIntelligence } from "@/lib/use-financial-intelligence";
import type {
  CalendarFilters,
  CalendarViewMode,
  FinancialCalendarEvent,
  NewCalendarEventInput,
} from "@/types/calendario";

const initialFilters: CalendarFilters = {
  search: "",
  type: "all",
  status: "all",
  accountId: "all",
};

function createId(value: string): string {
  return `${value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "") || "compromisso"}-${Date.now()}`;
}

function isIncome(event: FinancialCalendarEvent): boolean {
  return event.type === "income";
}

function isOutflow(event: FinancialCalendarEvent): boolean {
  return event.type !== "income" && event.type !== "transfer";
}

export default function CalendarioView() {
  const {
    referenceDate,
    accounts,
    accountNames,
    calendarEvents,
    setManualCalendarEvents,
    completeCalendarEvent,
  } = useFinancialIntelligence();
  const [monthKey, setMonthKey] = useState(getMonthKey(referenceDate));
  const [selectedDate, setSelectedDate] = useState(referenceDate);
  const [filters, setFilters] = useState<CalendarFilters>(initialFilters);
  const [viewMode, setViewMode] = useState<CalendarViewMode>("month");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState("");

  const monthEvents = useMemo(
    () => calendarEvents.filter((event) => event.date.startsWith(monthKey)),
    [calendarEvents, monthKey],
  );

  const filteredMonthEvents = useMemo(
    () => monthEvents.filter((event) => {
      const matchesQuery = matchesSearch(filters.search, [
        event.title,
        event.category,
        event.notes,
        event.sourceLabel,
        accountNames[event.accountId ?? ""],
        event.amount,
        event.date,
        formatSearchDate(event.date),
        calendarContent.types[event.type],
        calendarContent.statuses[event.status],
      ]);
      const matchesType = filters.type === "all" || event.type === filters.type;
      const matchesStatus = filters.status === "all" || event.status === filters.status;
      const matchesAccount = filters.accountId === "all" || event.accountId === filters.accountId;
      return matchesQuery && matchesType && matchesStatus && matchesAccount;
    }),
    [accountNames, filters, monthEvents],
  );

  const selectedDayEvents = useMemo(
    () => filteredMonthEvents
      .filter((event) => event.date === selectedDate)
      .sort((a, b) => a.status.localeCompare(b.status) || a.title.localeCompare(b.title, "pt-BR")),
    [filteredMonthEvents, selectedDate],
  );

  const summary = useMemo(() => {
    const income = monthEvents.filter(isIncome).reduce((total, event) => total + event.amount, 0);
    const expenses = monthEvents.filter(isOutflow).reduce((total, event) => total + event.amount, 0);
    const overdueEvents = monthEvents.filter((event) => event.status === "overdue");
    const overdue = overdueEvents
      .filter(isOutflow)
      .reduce((total, event) => total + event.amount, 0);
    const completed = monthEvents
      .filter((event) => event.status === "completed" && event.type !== "transfer")
      .reduce((total, event) => total + event.amount, 0);
    const pending = monthEvents
      .filter((event) => event.status !== "completed" && event.type !== "transfer")
      .reduce((total, event) => total + event.amount, 0);

    return {
      income,
      expenses,
      result: income - expenses,
      commitments: monthEvents.length,
      overdue,
      overdueCount: overdueEvents.length,
      completed,
      pending,
    };
  }, [monthEvents]);

  function showFeedback(message: string) {
    setFeedbackMessage(message);
    window.setTimeout(() => setFeedbackMessage(""), 2600);
  }

  function navigateMonth(offset: number) {
    const nextMonth = shiftMonth(monthKey, offset);
    setMonthKey(nextMonth);
    setSelectedDate(`${nextMonth}-01`);
  }

  function goToToday() {
    setMonthKey(getMonthKey(referenceDate));
    setSelectedDate(referenceDate);
  }

  function selectDate(date: string) {
    const nextMonth = getMonthKey(date);
    if (nextMonth !== monthKey) setMonthKey(nextMonth);
    setSelectedDate(date);
  }

  function createEvent(input: NewCalendarEventInput) {
    const nextEvent: FinancialCalendarEvent = {
      id: createId(input.title),
      ...input,
      status: input.date < referenceDate ? "overdue" : "scheduled",
      source: "manual",
    };

    setManualCalendarEvents((current) => [...current, nextEvent]
      .sort((a, b) => a.date.localeCompare(b.date)));
    setMonthKey(getMonthKey(input.date));
    setSelectedDate(input.date);
    showFeedback(calendarContent.dialog.success);
  }

  function completeEvent(eventId: string) {
    const event = calendarEvents.find((item) => item.id === eventId);
    if (!event || !completeCalendarEvent(event)) return;
    showFeedback(calendarContent.feedback.completed);
  }

  return (
    <div className="financial-management-page calendar-page">
      <CalendarHeading onNew={() => setDialogOpen(true)} />
      <CalendarSummary {...summary} />
      <CalendarToolbar
        monthKey={monthKey}
        filters={filters}
        viewMode={viewMode}
        accounts={accounts}
        onPreviousMonth={() => navigateMonth(-1)}
        onNextMonth={() => navigateMonth(1)}
        onToday={goToToday}
        onFiltersChange={setFilters}
        onViewModeChange={setViewMode}
      />

      {viewMode === "month" ? (
        <div className="calendar-workspace-grid">
          <MonthCalendar
            monthKey={monthKey}
            events={filteredMonthEvents}
            selectedDate={selectedDate}
            referenceDate={referenceDate}
            onSelectDate={selectDate}
          />
          <div className="calendar-side-column">
            <DayAgenda
              selectedDate={selectedDate}
              events={selectedDayEvents}
              accounts={accounts}
              onComplete={completeEvent}
            />
            <MonthProjection
              income={summary.income}
              expenses={summary.expenses}
              completed={summary.completed}
              pending={summary.pending}
            />
          </div>
        </div>
      ) : (
        <CalendarAgendaList
          events={filteredMonthEvents}
          accounts={accounts}
          onSelectDate={(date) => {
            selectDate(date);
            setViewMode("month");
          }}
        />
      )}

      {dialogOpen ? (
        <NewCalendarEventDialog
          accounts={accounts}
          initialDate={selectedDate}
          onClose={() => setDialogOpen(false)}
          onSubmit={createEvent}
        />
      ) : null}

      {feedbackMessage ? (
        <div className="transaction-feedback"><CheckIcon /> {feedbackMessage}</div>
      ) : null}
    </div>
  );
}
