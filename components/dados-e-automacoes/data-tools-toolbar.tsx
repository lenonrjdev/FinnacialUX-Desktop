import {
  ClockIcon,
  DownloadIcon,
  MagicWandIcon,
  UploadIcon,
} from "@/components/shared/icons";
import { dataToolsContent } from "@/content/dados-e-automacoes";
import type { DataToolsView } from "@/types/dados-e-automacoes";

const tabs: Array<{ id: DataToolsView; icon: React.ReactNode }> = [
  { id: "import", icon: <UploadIcon /> },
  { id: "export", icon: <DownloadIcon /> },
  { id: "rules", icon: <MagicWandIcon /> },
  { id: "history", icon: <ClockIcon /> },
];

export function DataToolsToolbar({
  view,
  onChange,
}: {
  view: DataToolsView;
  onChange: (view: DataToolsView) => void;
}) {
  return (
    <section className="data-tools-toolbar" role="tablist" aria-label={dataToolsContent.accessibility.views}>
      {tabs.map((tab) => (
        <button
          type="button"
          className={view === tab.id ? "active" : ""}
          onClick={() => onChange(tab.id)}
          key={tab.id}
        >
          {tab.icon}
          <span>{dataToolsContent.views[tab.id]}</span>
        </button>
      ))}
    </section>
  );
}
