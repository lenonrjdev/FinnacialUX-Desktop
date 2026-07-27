import { CalendarEventIcon } from "@/components/calendario/calendar-event-icon";
import { calendarContent } from "@/content/calendario";
import { formatLongCalendarDate } from "@/lib/calendar";
import { formatCurrency } from "@/lib/formatters";
import type { FinancialAccount } from "@/types/contas";
import type { FinancialCalendarEvent } from "@/types/calendario";

type CalendarAgendaListProps = {
  events: FinancialCalendarEvent[];
  accounts: FinancialAccount[];
  onSelectDate: (date: string) => void;
};

export function CalendarAgendaList({ events, accounts, onSelectDate }: CalendarAgendaListProps) {
  const groups = events.reduce<Record<string, FinancialCalendarEvent[]>>((result, event) => {
    result[event.date] = [...(result[event.date] ?? []), event];
    return result;
  }, {});
  const dates = Object.keys(groups).sort();

  return (
    <section className="calendar-agenda-list">
      <header>
        <div>
          <span className="section-eyebrow">{calendarContent.agenda.eyebrow}</span>
          <h2>{calendarContent.agenda.title}</h2>
        </div>
        <span>{events.length} {calendarContent.agenda.eventsFound}</span>
      </header>

      {dates.length ? (
        <div className="calendar-agenda-groups">
          {dates.map((date) => (
            <section className="calendar-agenda-group" key={date}>
              <button type="button" onClick={() => onSelectDate(date)}>
                <strong>{formatLongCalendarDate(date)}</strong>
                <span>{groups[date].length} {groups[date].length === 1 ? calendarContent.agenda.itemSingular : calendarContent.agenda.itemPlural}</span>
              </button>
              <div>
                {groups[date].map((event) => {
                  const account = accounts.find((item) => item.id === event.accountId);
                  return (
                    <article className={`calendar-agenda-row type-${event.type}`} key={event.id}>
                      <span className="calendar-agenda-icon"><CalendarEventIcon type={event.type} /></span>
                      <div>
                        <strong>{event.title}</strong>
                        <small>{event.category}{account ? ` · ${account.name}` : ""}</small>
                      </div>
                      <span className={`calendar-status-badge status-${event.status}`}>{calendarContent.statuses[event.status]}</span>
                      <strong className={event.type === "income" ? "positive" : ""}>
                        {event.type === "income" ? "+ " : ""}{formatCurrency(event.amount)}
                      </strong>
                    </article>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <div className="calendar-agenda-empty">
          <strong>{calendarContent.agenda.noEventsTitle}</strong>
          <p>{calendarContent.agenda.noEventsDescription}</p>
        </div>
      )}
    </section>
  );
}
