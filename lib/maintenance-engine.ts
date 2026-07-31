import type {
  MaintenanceCheck,
  MaintenancePreferences,
  MaintenanceReport,
  MaintenanceSnapshot,
} from "@/types/maintenance";

export const DEFAULT_MAINTENANCE_PREFERENCES: MaintenancePreferences = {
  automaticMaintenance: true,
  maintenanceWeekday: 6,
  maintenanceStartHour: 9,
  maintenanceWindowDuration: 2,
  installOnlyInsideWindow: false,
  requireVerifiedBackup: true,
  localTechnicalJournal: false,
  journalRetention: 10,
  deferredUpdatesUntil: null,
  lastMaintenanceAt: null,
};

function validDate(value: string | null): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function isUpdateDeferred(preferences: MaintenancePreferences, now = new Date()): boolean {
  const until = validDate(preferences.deferredUpdatesUntil);
  return Boolean(until && until.getTime() > now.getTime());
}

export function deferUpdates(
  preferences: MaintenancePreferences,
  days: 1 | 3 | 7,
  now = new Date(),
): MaintenancePreferences {
  const until = new Date(now);
  until.setDate(until.getDate() + days);
  return { ...preferences, deferredUpdatesUntil: until.toISOString() };
}

export function isWithinMaintenanceWindow(
  preferences: MaintenancePreferences,
  now = new Date(),
): boolean {
  if (now.getDay() !== preferences.maintenanceWeekday) return false;
  const start = preferences.maintenanceStartHour;
  const end = start + preferences.maintenanceWindowDuration;
  const hour = now.getHours() + now.getMinutes() / 60;
  return hour >= start && hour < end;
}

export function nextMaintenanceWindow(
  preferences: MaintenancePreferences,
  now = new Date(),
): Date {
  const candidate = new Date(now);
  candidate.setSeconds(0, 0);
  candidate.setMinutes(0);
  candidate.setHours(preferences.maintenanceStartHour);
  let delta = (preferences.maintenanceWeekday - candidate.getDay() + 7) % 7;
  if (delta === 0 && candidate.getTime() <= now.getTime()) delta = 7;
  candidate.setDate(candidate.getDate() + delta);
  return candidate;
}

function ageInDays(value: string | null, now: Date): number | null {
  const date = validDate(value);
  if (!date) return null;
  return Math.max(0, (now.getTime() - date.getTime()) / 86_400_000);
}

function check(
  id: string,
  title: string,
  detail: string,
  status: MaintenanceCheck["status"],
  required = true,
): MaintenanceCheck {
  return { id, title, detail, status, required };
}

export function createMaintenanceReport(
  snapshot: MaintenanceSnapshot,
  preferences: MaintenancePreferences,
): MaintenanceReport {
  const now = validDate(snapshot.now) ?? new Date();
  const backupAge = ageInDays(snapshot.latestBackupAt, now);
  const diagnosticAge = ageInDays(snapshot.latestDiagnosticAt, now);
  const maintenanceAge = ageInDays(preferences.lastMaintenanceAt, now);
  const checks: MaintenanceCheck[] = [
    check(
      "version",
      "Versão operacional",
      snapshot.currentVersion === "1.1.0"
        ? "A manutenção pós-lançamento está alinhada à versão 1.1.0."
        : `Versão esperada 1.1.0; encontrada ${snapshot.currentVersion}.`,
      snapshot.currentVersion === "1.1.0" ? "passed" : "blocked",
    ),
    check(
      "schema",
      "Schema congelado",
      snapshot.schemaVersion === 14
        ? "O schema SQLCipher permanece congelado em 14."
        : `O schema precisa permanecer em 14; encontrado ${snapshot.schemaVersion ?? "indisponível"}.`,
      snapshot.schemaVersion === 14 ? "passed" : "blocked",
    ),
    check(
      "updater",
      "Canal assinado",
      snapshot.updaterConfigured
        ? "O canal estável está configurado para pacotes assinados."
        : "O canal de atualização precisa ser configurado antes da distribuição.",
      snapshot.updaterConfigured ? "passed" : "blocked",
    ),
  ];
  checks.push(check(
    "backup",
    "Backup de recuperação",
    backupAge === null
      ? "Nenhum backup recente foi localizado."
      : backupAge <= 7
        ? "Existe uma cópia criptografada criada nos últimos sete dias."
        : `O backup mais recente tem ${Math.floor(backupAge)} dias.`,
    backupAge === null ? (preferences.requireVerifiedBackup ? "blocked" : "attention") : backupAge <= 7 ? "passed" : backupAge <= 30 ? "attention" : "blocked",
    preferences.requireVerifiedBackup,
  ));
  checks.push(check(
    "backup-policy",
    "Backup pré-atualização",
    snapshot.backupBeforeInstall
      ? "Atualizações criam uma cópia criptografada antes da instalação."
      : "Ative o backup pré-atualização para permitir rollback seguro.",
    snapshot.backupBeforeInstall ? "passed" : "blocked",
  ));
  checks.push(check(
    "diagnostics",
    "Diagnóstico periódico",
    diagnosticAge === null
      ? "Ainda não existe uma auditoria local registrada."
      : diagnosticAge <= 30
        ? "A auditoria local está dentro do ciclo recomendado."
        : `A última auditoria foi executada há ${Math.floor(diagnosticAge)} dias.`,
    diagnosticAge !== null && diagnosticAge <= 30 ? "passed" : "attention",
    false,
  ));
  checks.push(check(
    "journal",
    "Erros técnicos locais",
    snapshot.unresolvedTechnicalErrors === 0
      ? "Nenhum erro técnico recente está pendente."
      : `${snapshot.unresolvedTechnicalErrors} erro(s) técnico(s) sanitizado(s) aguardam revisão.`,
    snapshot.unresolvedTechnicalErrors === 0 ? "passed" : "attention",
    false,
  ));
  checks.push(check(
    "maintenance",
    "Ciclo de manutenção",
    maintenanceAge === null
      ? "A primeira manutenção ainda não foi registrada."
      : maintenanceAge <= 30
        ? "O ciclo de manutenção está em dia."
        : `A última manutenção foi registrada há ${Math.floor(maintenanceAge)} dias.`,
    maintenanceAge !== null && maintenanceAge <= 30 ? "passed" : "attention",
    false,
  ));
  checks.push(check(
    "read-only",
    "Modo de proteção",
    snapshot.readOnly
      ? "O modo somente leitura está ativo; reparos automáticos permanecem suspensos."
      : "O espaço permite manutenção controlada.",
    snapshot.readOnly ? "attention" : "passed",
    false,
  ));

  const passed = checks.filter((item) => item.status === "passed").length;
  const attention = checks.filter((item) => item.status === "attention").length;
  const blocked = checks.filter((item) => item.status === "blocked").length;
  const score = Math.max(0, Math.round((passed * 100 + attention * 55) / checks.length));
  return {
    ready: checks.every((item) => !item.required || item.status === "passed"),
    score,
    passed,
    attention,
    blocked,
    nextWindowAt: nextMaintenanceWindow(preferences, now).toISOString(),
    deferred: isUpdateDeferred(preferences, now),
    checks,
  };
}

export function formatMaintenanceSummary(report: MaintenanceReport): string {
  return [
    "FinnacialUX Desktop — manutenção pós-lançamento",
    `Pontuação: ${report.score}/100`,
    `Aprovados: ${report.passed}`,
    `Atenção: ${report.attention}`,
    `Bloqueios: ${report.blocked}`,
    `Próxima janela: ${report.nextWindowAt}`,
    `Atualizações adiadas: ${report.deferred ? "sim" : "não"}`,
    "",
    ...report.checks.map((item) => `[${item.status.toUpperCase()}] ${item.title}: ${item.detail}`),
  ].join("\n");
}
