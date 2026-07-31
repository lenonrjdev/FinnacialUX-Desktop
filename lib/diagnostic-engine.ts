import type {
  DiagnosticCategory,
  DiagnosticCheck,
  DiagnosticRepairAction,
  DiagnosticSuiteResult,
} from "@/types/diagnostics";

export const diagnosticCategoryLabels: Record<DiagnosticCategory, string> = {
  database: "Banco local",
  security: "Cofre e chaves",
  files: "Pastas e disco",
  backups: "Backups",
  continuity: "Continuidade",
  scheduler: "Rotinas locais",
  updates: "Atualizações",
  privacy: "Privacidade",
};

export const diagnosticRepairLabels: Record<DiagnosticRepairAction, string> = {
  optimize_database: "Otimizar banco local",
  release_stale_tasks: "Liberar rotinas travadas",
  refresh_file_health: "Atualizar estado dos arquivos",
  clear_old_logs: "Limpar logs antigos",
};

export function diagnosticHealthLabel(
  score: number,
  failed: number,
  attention: number,
): "healthy" | "attention" | "failed" {
  if (failed > 0 || score < 60) return "failed";
  if (attention > 0 || score < 90) return "attention";
  return "healthy";
}

export function groupDiagnosticChecks(
  checks: DiagnosticCheck[],
): Array<{ category: DiagnosticCategory; label: string; checks: DiagnosticCheck[] }> {
  const order: DiagnosticCategory[] = [
    "database",
    "security",
    "backups",
    "continuity",
    "scheduler",
    "updates",
    "files",
    "privacy",
  ];
  return order
    .map((category) => ({
      category,
      label: diagnosticCategoryLabels[category],
      checks: checks.filter((check) => check.category === category),
    }))
    .filter((group) => group.checks.length > 0);
}

export function recommendedRepairs(checks: DiagnosticCheck[]): DiagnosticRepairAction[] {
  return checks.reduce<DiagnosticRepairAction[]>((actions, check) => {
    if (check.repairAction && !actions.includes(check.repairAction)) {
      actions.push(check.repairAction);
    }
    return actions;
  }, []);
}

export function formatDiagnosticSummary(suite: DiagnosticSuiteResult): string {
  return [
    `FinnacialUX Desktop — diagnóstico local`,
    `Pontuação: ${suite.score}/100`,
    `Aprovados: ${suite.checksPassed}`,
    `Atenção: ${suite.checksAttention}`,
    `Falhas: ${suite.checksFailed}`,
    `Somente leitura: ${suite.readOnly ? "sim" : "não"}`,
    `Gerado em: ${suite.completedAt}`,
  ].join("\n");
}

export function supportPackageFileName(date = new Date()): string {
  const stamp = date.toISOString().replace(/[:.]/g, "-").slice(0, 19);
  return `FinnacialUX-suporte-${stamp}.fuxsupport`;
}
