import {
  CheckIcon,
  ClockIcon,
  DatabaseIcon,
  MagicWandIcon,
} from "@/components/shared/icons";
import { dataToolsContent } from "@/content/dados-e-automacoes";
import type { ImportHistoryItem } from "@/types/dados-e-automacoes";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

export function DataToolsSummary({
  previewRows,
  activeRules,
  history,
}: {
  previewRows: number;
  activeRules: number;
  history: ImportHistoryItem[];
}) {
  const latest = [...history].sort((a, b) => b.importedAt.localeCompare(a.importedAt))[0];
  const cards = [
    {
      key: "preview",
      label: dataToolsContent.summary.previewRows,
      value: String(previewRows),
      helper: previewRows ? dataToolsContent.preview.editHint : dataToolsContent.preview.noRows,
      icon: <CheckIcon />,
      featured: true,
    },
    {
      key: "rules",
      label: dataToolsContent.summary.activeRules,
      value: String(activeRules),
      helper: dataToolsContent.summary.rulesHelper,
      icon: <MagicWandIcon />,
    },
    {
      key: "history",
      label: dataToolsContent.summary.lastImport,
      value: latest ? formatDate(latest.importedAt) : "—",
      helper: latest?.fileName ?? dataToolsContent.summary.noImport,
      icon: <ClockIcon />,
    },
    {
      key: "datasets",
      label: dataToolsContent.summary.datasets,
      value: dataToolsContent.summary.datasetCount,
      helper: dataToolsContent.summary.datasetsHelper,
      icon: <DatabaseIcon />,
    },
  ];

  return (
    <section className="data-tools-summary-grid" aria-label={dataToolsContent.accessibility.summary}>
      {cards.map((card) => (
        <article className={`data-tools-summary-card ${card.featured ? "featured" : ""}`} key={card.key}>
          <span className="data-tools-summary-icon">{card.icon}</span>
          <span>{card.label}</span>
          <strong>{card.value}</strong>
          <small>{card.helper}</small>
        </article>
      ))}
    </section>
  );
}
