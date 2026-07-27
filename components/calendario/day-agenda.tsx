import { CalendarEventIcon } from "@/components/calendario/calendar-event-icon";
import { CheckIcon } from "@/components/shared/icons";
import { calendarContent } from "@/content/calendario";
import { formatLongCalendarDate } from "@/lib/calendar";
import { formatCurrency, formatSignedCurrency } from "@/lib/formatters";
import type { FinancialAccount } from "@/types/contas";
import type { FinancialCalendarEvent } from "@/types/calendario";

type DayAgendaProps = {
  selectedDate: string;
  events: FinancialCalendarEvent[];
  accounts: FinancialAccount[];
  onComplete: (eventId: string) => void;
};

function isIncome(event: FinancialCalendarEvent): boolean {
  return event.type === "income";
}

export function DayAgenda({ selectedDate, events, accounts, onComplete }: DayAgendaProps) {
  const income = events.filter(isIncome).reduce((total, event) => total + event.amount, 0);
  const expenses = events.filter((event) => !isIncome(event) && event.type !== "transfer").reduce((total, event) => total + event.amount, 0);
  const result = income - expenses;

  return (
    <aside className="day-agenda-panel">
      <header className="day-agenda-header">
        <span className="section-eyebrow">{calendarContent.dayPanel.eyebrow}</span>
        <h2>{formatLongCalendarDate(selectedDate)}</h2>
      </header>

      <div className="day-agenda-totals">
        <div>
          <span>{calendarContent.dayPanel.income}</span>
          <strong className="positive">{formatCurrency(income)}</strong>
        </div>
        <div>
          <span>{calendarContent.dayPanel.expenses}</span>
          <strong>{formatCurrency(expenses)}</strong>
        </div>
        <div className="day-agenda-result">
          <span>{calendarContent.dayPanel.balance}</span>
          <strong className={result < 0 ? "negative" : "positive"}>{formatSignedCurrency(result)}</strong>
        </div>
      </div>

      <div className="day-agenda-events">
        {events.length ? events.map((event) => {
          const account = accounts.find((item) => item.id === event.accountId);

          return (
            <article className={`day-agenda-event type-${event.type}`} key={event.id}>
              <span className="day-agenda-event-icon"><CalendarEventIcon type={event.type} /></span>
              <div className="day-agenda-event-copy">
                <div>
                  <strong>{event.title}</strong>
                  <span className={`calendar-status-badge status-${event.status}`}>
                    {calendarContent.statuses[event.status]}
                  </span>
                </div>
                <small>{event.category}{account ? ` · ${account.name}` : ""}</small>
                {event.notes ? <p>{event.notes}</p> : null}
              </div>
              <strong className={isIncome(event) ? "positive" : ""}>
                {isIncome(event) ? "+ " : ""}{formatCurrency(event.amount)}
              </strong>
              {event.status !== "completed" ? (
                <button type="button" onClick={() => onComplete(event.id)}>
                  <CheckIcon />
                  {calendarContent.dayPanel.markCompleted}
                </button>
              ) : (
                <span className="day-agenda-completed"><CheckIcon /> {calendarContent.dayPanel.completed}</span>
              )}
            </article>
          );
        }) : (
          <div className="day-agenda-empty">
            <span>00</span>
            <strong>{calendarContent.dayPanel.emptyTitle}</strong>
            <p>{calendarContent.dayPanel.emptyDescription}</p>
          </div>
        )}
      </div>
    </aside>
  );
}
