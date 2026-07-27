import { CheckIcon, SaveIcon } from "@/components/shared/icons";
import { settingsContent } from "@/content/configuracoes";

export function SettingsHeading({ onSave, saving }: { onSave: () => void; saving: boolean }) {
  return (
    <header className="financial-management-heading settings-heading">
      <div>
        <span className="section-eyebrow">{settingsContent.heading.eyebrow}</span>
        <h1>{settingsContent.heading.title}</h1>
        <p>{settingsContent.heading.description}</p>
      </div>
      <button className="primary-action-button" type="button" onClick={onSave}>
        {saving ? <CheckIcon /> : <SaveIcon />}
        {saving ? settingsContent.heading.saved : settingsContent.heading.save}
      </button>
    </header>
  );
}
