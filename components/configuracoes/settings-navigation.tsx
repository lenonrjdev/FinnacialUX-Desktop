import {
  ArchiveIcon,
  BellIcon,
  HistoryIcon,
  PaletteIcon,
  ShieldIcon,
  UserIcon,
} from "@/components/shared/icons";
import { settingsContent } from "@/content/configuracoes";
import type { SettingsView } from "@/types/configuracoes";

const navigation: Array<{ key: SettingsView; icon: React.ReactNode }> = [
  { key: "profile", icon: <UserIcon /> },
  { key: "preferences", icon: <PaletteIcon /> },
  { key: "notifications", icon: <BellIcon /> },
  { key: "security", icon: <ShieldIcon /> },
  { key: "activity", icon: <HistoryIcon /> },
  { key: "backups", icon: <ArchiveIcon /> },
];

export function SettingsNavigation({ value, onChange }: { value: SettingsView; onChange: (view: SettingsView) => void }) {
  return (
    <nav className="settings-navigation" aria-label={settingsContent.accessibility.settingsNavigation}>
      {navigation.map((item) => (
        <button
          className={value === item.key ? "active" : ""}
          type="button"
          key={item.key}
          onClick={() => onChange(item.key)}
        >
          {item.icon}
          <span>{settingsContent.views[item.key]}</span>
        </button>
      ))}
    </nav>
  );
}
