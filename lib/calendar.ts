export type CalendarDayCell = {
  date: string;
  dayNumber: number;
  belongsToMonth: boolean;
};

const monthFormatter = new Intl.DateTimeFormat("pt-BR", {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

const longDateFormatter = new Intl.DateTimeFormat("pt-BR", {
  weekday: "long",
  day: "2-digit",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

const compactDateFormatter = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "short",
  timeZone: "UTC",
});

function capitalize(value: string): string {
  return value.charAt(0).toLocaleUpperCase("pt-BR") + value.slice(1);
}

export function createUtcDate(value: string): Date {
  return new Date(`${value}T12:00:00Z`);
}

export function toDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function getMonthKey(value: string): string {
  return value.slice(0, 7);
}

export function formatMonthLabel(monthKey: string): string {
  return capitalize(monthFormatter.format(createUtcDate(`${monthKey}-01`)));
}

export function formatLongCalendarDate(value: string): string {
  return capitalize(longDateFormatter.format(createUtcDate(value)));
}

export function formatCompactCalendarDate(value: string): string {
  return compactDateFormatter.format(createUtcDate(value)).replace(".", "");
}

export function shiftMonth(monthKey: string, offset: number): string {
  const date = createUtcDate(`${monthKey}-01`);
  date.setUTCMonth(date.getUTCMonth() + offset);
  return toDateKey(date).slice(0, 7);
}

export function getCalendarDays(monthKey: string): CalendarDayCell[] {
  const firstDay = createUtcDate(`${monthKey}-01`);
  const firstWeekday = firstDay.getUTCDay();
  const gridStart = new Date(firstDay);
  gridStart.setUTCDate(firstDay.getUTCDate() - firstWeekday);

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(gridStart);
    date.setUTCDate(gridStart.getUTCDate() + index);
    const dateKey = toDateKey(date);

    return {
      date: dateKey,
      dayNumber: date.getUTCDate(),
      belongsToMonth: dateKey.startsWith(monthKey),
    };
  });
}
