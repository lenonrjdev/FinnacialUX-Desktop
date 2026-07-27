import { downloadTextFile } from "@/lib/data-tools";
import type {
  ActivityLogEntry,
  AppearanceMode,
  BackupSettings,
  FinancialPreferences,
  NotificationSettings,
  ProfileSettings,
  SecuritySettings,
} from "@/types/configuracoes";

const APPEARANCE_STORAGE_KEY = "finance-dashboard-appearance";

type ResolvedAppearance = Exclude<AppearanceMode, "system">;

function isAppearanceMode(value: string | null): value is AppearanceMode {
  return value === "light" || value === "dark" || value === "system";
}

export function getStoredAppearance(fallback: AppearanceMode = "system"): AppearanceMode {
  if (typeof window === "undefined") return fallback;
  try {
    const stored = window.localStorage.getItem(APPEARANCE_STORAGE_KEY);
    return isAppearanceMode(stored) ? stored : fallback;
  } catch {
    return fallback;
  }
}

export function resolveAppearance(mode: AppearanceMode): ResolvedAppearance {
  if (mode !== "system") return mode;
  if (typeof window === "undefined") return "light";
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function applyAppearance(mode: AppearanceMode): ResolvedAppearance {
  const resolved = resolveAppearance(mode);
  if (typeof document !== "undefined") {
    document.documentElement.dataset.theme = resolved;
    document.documentElement.dataset.appearancePreference = mode;
    document.documentElement.style.colorScheme = resolved;
  }
  return resolved;
}

export function persistAppearance(mode: AppearanceMode): ResolvedAppearance {
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(APPEARANCE_STORAGE_KEY, mode);
    } catch {
      // O backend ainda mantém a preferência; o armazenamento local evita troca de tema entre rotas.
    }
  }

  const resolved = applyAppearance(mode);
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("finance-appearance-change", {
      detail: { appearance: mode, resolved },
    }));
  }
  return resolved;
}

export function persistFinancialPreferences(value: FinancialPreferences): void {
  persistAppearance(value.appearance);
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("finance-preferences-change", { detail: value }));
  }
}

export function getOppositeAppearance(): ResolvedAppearance {
  if (typeof document !== "undefined" && document.documentElement.dataset.theme === "dark") {
    return "light";
  }
  return "dark";
}

export function formatSettingsDateTime(value: string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Sao_Paulo",
  }).format(new Date(value));
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1).replace(".", ",")} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1).replace(".", ",")} MB`;
}

export function createSettingsBackup(
  profile: ProfileSettings,
  preferences: FinancialPreferences,
  notifications: NotificationSettings,
  security: SecuritySettings,
  backupSettings: BackupSettings,
) {
  return {
    generatedAt: new Date().toISOString(),
    version: "fase-15.2-postgresql",
    account: {
      profile,
      preferences,
      notifications,
      security: {
        ...security,
        password: undefined,
      },
      backupSettings,
    },
  };
}

export function downloadFullSettingsBackup(payload: ReturnType<typeof createSettingsBackup>): string {
  const date = new Date().toISOString().slice(0, 10);
  const fileName = `backup-financeiro-completo-${date}.json`;
  downloadTextFile(JSON.stringify(payload, null, 2), fileName, "application/json;charset=utf-8");
  return fileName;
}

export function isValidFinanceBackup(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Record<string, unknown>;
  return typeof candidate.generatedAt === "string"
    && Array.isArray(candidate.transactions)
    && Array.isArray(candidate.accounts)
    && typeof candidate.cards === "object";
}

function escapeCsv(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

export function exportActivityHistory(entries: ActivityLogEntry[]): void {
  const rows = [
    ["Data", "Tipo", "Título", "Descrição", "Responsável", "Dispositivo", "Estado"],
    ...entries.map((entry) => [
      formatSettingsDateTime(entry.occurredAt),
      entry.type,
      entry.title,
      entry.description,
      entry.actor,
      entry.device,
      entry.status,
    ]),
  ];
  const csv = `\uFEFF${rows.map((row) => row.map(escapeCsv).join(";")).join("\r\n")}`;
  downloadTextFile(csv, `historico-de-atividades-${new Date().toISOString().slice(0, 10)}.csv`, "text/csv;charset=utf-8");
}
