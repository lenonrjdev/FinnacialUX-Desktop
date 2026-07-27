import { PlusIcon } from "@/components/shared/icons";
import { calendarContent } from "@/content/calendario";

export function CalendarHeading({ onNew }: { onNew: () => void }) {
  return (
    <header className="financial-management-heading calendar-heading">
      <div>
        <span className="section-eyebrow">{calendarContent.heading.eyebrow}</span>
        <h1>{calendarContent.heading.title}</h1>
        <p>{calendarContent.heading.description}</p>
      </div>

      <button className="primary-action-button" type="button" onClick={onNew}>
        <PlusIcon />
        {calendarContent.heading.newAction}
      </button>
    </header>
  );
}
