import { CalendarEventIcon } from "@/components/calendario/calendar-event-icon";
import { calendarContent } from "@/content/calendario";
import { getCalendarDays } from "@/lib/calendar";
import type { FinancialCalendarEvent } from "@/types/calendario";

type MonthCalendarProps = {
  monthKey: string;
  events: FinancialCalendarEvent[];
  selectedDate: string;
  referenceDate: string;
  onSelectDate: (date: string) => void;
};

const statusOrder = { overdue: 0, scheduled: 1, completed: 2 } as const;

export function MonthCalendar({
  monthKey,
  events,
  selectedDate,
  referenceDate,
  onSelectDate,
}: MonthCalendarProps) {
  const days = getCalendarDays(monthKey);

  return (
    <section className="month-calendar-panel" aria-label={calendarContent.calendar.ariaLabel}>
      <div className="calendar-weekday-row" aria-hidden="true">
        {calendarContent.weekdays.map((weekday) => (
          <span key={weekday}>{weekday}</span>
        ))}
      </div>

      <div className="calendar-days-grid">
        {days.map((day) => {
          const dayEvents = events
            .filter((event) => event.date === day.date)
            .sort((a, b) => statusOrder[a.status] - statusOrder[b.status] || a.title.localeCompare(b.title));
          const visibleEvents = dayEvents.slice(0, 3);
          const remainingEvents = dayEvents.length - visibleEvents.length;
          const selected = selectedDate === day.date;
          const today = referenceDate === day.date;

          return (
            <button
              className={`calendar-day-cell ${day.belongsToMonth ? "" : "outside-month"} ${selected ? "selected" : ""} ${today ? "today" : ""}`}
              type="button"
              key={day.date}
              onClick={() => onSelectDate(day.date)}
              aria-label={`${day.dayNumber}, ${dayEvents.length} ${calendarContent.calendar.dayAriaSuffix}`}
            >
              <span className="calendar-day-number">
                {day.dayNumber}
                {today ? <small>{calendarContent.calendar.today}</small> : null}
              </span>

              <span className="calendar-cell-events">
                {visibleEvents.map((event) => (
                  <span
                    className={`calendar-event-chip type-${event.type} status-${event.status}`}
                    key={event.id}
                    title={event.title}
                  >
                    <CalendarEventIcon type={event.type} />
                    <span>{event.title}</span>
                  </span>
                ))}
                {remainingEvents > 0 ? (
                  <span className="calendar-more-events">+{remainingEvents} {calendarContent.calendar.moreEvents}</span>
                ) : null}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
