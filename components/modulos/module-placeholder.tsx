import { CheckIcon, ReportsIcon } from "@/components/shared/icons";
import { modulePlaceholderContent } from "@/content/modules";

export default function ModulePlaceholder({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <section className="module-placeholder">
      <div className="module-placeholder-copy">
        <span className="page-eyebrow">{modulePlaceholderContent.eyebrow}</span>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>

      <article className="module-placeholder-card">
        <span className="placeholder-icon" aria-hidden="true">
          <ReportsIcon />
        </span>
        <div>
          <strong>{modulePlaceholderContent.cardTitle}</strong>
          <p>{modulePlaceholderContent.cardDescription}</p>
        </div>
        <span className="placeholder-status">
          <CheckIcon /> {modulePlaceholderContent.status}
        </span>
      </article>
    </section>
  );
}
