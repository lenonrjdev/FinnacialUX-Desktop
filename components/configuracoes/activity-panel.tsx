import { useMemo, useState } from "react";
import {
  ArchiveIcon,
  DatabaseIcon,
  DownloadIcon,
  HistoryIcon,
  LockIcon,
  SearchIcon,
  ShieldIcon,
  UserIcon,
  WorkspaceIcon,
} from "@/components/shared/icons";
import { settingsContent } from "@/content/configuracoes";
import { formatSearchDate, matchesSearch } from "@/lib/search";
import { exportActivityHistory, formatSettingsDateTime } from "@/lib/settings";
import type { ActivityLogEntry, ActivityStatus, ActivityType } from "@/types/configuracoes";

const typeIcons: Record<ActivityType, React.ReactNode> = {
  login: <LockIcon />,
  security: <ShieldIcon />,
  profile: <UserIcon />,
  workspace: <WorkspaceIcon />,
  data: <DatabaseIcon />,
  backup: <ArchiveIcon />,
};

export function ActivityPanel({ entries }: { entries: ActivityLogEntry[] }) {
  const [query, setQuery] = useState("");
  const [type, setType] = useState<"all" | ActivityType>("all");
  const [status, setStatus] = useState<"all" | ActivityStatus>("all");

  const filteredEntries = useMemo(() => entries.filter((entry) => {
    const matchesQuery = matchesSearch(query, [
      entry.title,
      entry.description,
      entry.actor,
      entry.device,
      entry.type,
      settingsContent.activity.types[entry.type],
      entry.status,
      settingsContent.activity.statuses[entry.status],
      entry.occurredAt,
      formatSearchDate(entry.occurredAt.slice(0, 10)),
    ]);
    return matchesQuery && (type === "all" || entry.type === type) && (status === "all" || entry.status === status);
  }), [entries, query, status, type]);

  return (
    <section className="settings-panel activity-settings-panel">
      <header className="settings-panel-header activity-panel-header">
        <div>
          <span className="section-eyebrow">{settingsContent.views.activity}</span>
          <h2>{settingsContent.activity.title}</h2>
          <p>{settingsContent.activity.description}</p>
        </div>
        <button className="secondary-action-button" type="button" onClick={() => exportActivityHistory(filteredEntries)}><DownloadIcon /> {settingsContent.activity.export}</button>
      </header>

      <div className="activity-filters">
        <label className="settings-search-field"><SearchIcon /><input placeholder={settingsContent.activity.search} value={query} onChange={(event) => setQuery(event.target.value)} /></label>
        <select value={type} onChange={(event) => setType(event.target.value as "all" | ActivityType)}>
          <option value="all">{settingsContent.activity.allTypes}</option>
          {(Object.keys(settingsContent.activity.types) as ActivityType[]).map((item) => <option value={item} key={item}>{settingsContent.activity.types[item]}</option>)}
        </select>
        <select value={status} onChange={(event) => setStatus(event.target.value as "all" | ActivityStatus)}>
          <option value="all">{settingsContent.activity.allStatuses}</option>
          {(Object.keys(settingsContent.activity.statuses) as ActivityStatus[]).map((item) => <option value={item} key={item}>{settingsContent.activity.statuses[item]}</option>)}
        </select>
      </div>

      <div className="activity-list">
        {filteredEntries.length ? filteredEntries.map((entry) => (
          <article key={entry.id}>
            <span className={`activity-type-icon ${entry.status}`}>{typeIcons[entry.type]}</span>
            <div className="activity-copy">
              <div><strong>{entry.title}</strong><span className={`activity-status ${entry.status}`}>{settingsContent.activity.statuses[entry.status]}</span></div>
              <p>{entry.description}</p>
              <small>{settingsContent.activity.actor}: {entry.actor} · {settingsContent.activity.device}: {entry.device}</small>
            </div>
            <time dateTime={entry.occurredAt}>{formatSettingsDateTime(entry.occurredAt)}</time>
          </article>
        )) : <div className="settings-empty-state"><HistoryIcon /><p>{settingsContent.activity.empty}</p></div>}
      </div>
    </section>
  );
}
