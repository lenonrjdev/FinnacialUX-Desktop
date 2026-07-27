import { ArchiveIcon, ClockIcon, ShieldIcon, UserIcon } from "@/components/shared/icons";
import { settingsContent } from "@/content/configuracoes";
import { formatSettingsDateTime } from "@/lib/settings";

export function SettingsSummary({
  profileName,
  profileEmail,
  protectedAccount,
  lastActivityAt,
  backupsCount,
}: {
  profileName: string;
  profileEmail: string;
  protectedAccount: boolean;
  lastActivityAt: string;
  backupsCount: number;
}) {
  const cards = [
    {
      key: "account",
      label: settingsContent.summary.account,
      value: profileName,
      helper: profileEmail,
      icon: <UserIcon />,
      featured: true,
    },
    {
      key: "protection",
      label: settingsContent.summary.protection,
      value: protectedAccount ? settingsContent.summary.protectionEnabled : settingsContent.summary.protectionPending,
      helper: settingsContent.summary.protectionHelper,
      icon: <ShieldIcon />,
    },
    {
      key: "activity",
      label: settingsContent.summary.lastActivity,
      value: formatSettingsDateTime(lastActivityAt),
      helper: settingsContent.summary.lastActivityHelper,
      icon: <ClockIcon />,
    },
    {
      key: "backups",
      label: settingsContent.summary.backups,
      value: String(backupsCount),
      helper: settingsContent.summary.backupsHelper,
      icon: <ArchiveIcon />,
    },
  ];

  return (
    <section className="settings-summary-grid" aria-label={settingsContent.accessibility.summary}>
      {cards.map((card) => (
        <article className={`settings-summary-card ${card.featured ? "featured" : ""}`} key={card.key}>
          <span className="settings-summary-icon">{card.icon}</span>
          <span>{card.label}</span>
          <strong title={card.value}>{card.value}</strong>
          <small>{card.helper}</small>
        </article>
      ))}
    </section>
  );
}
