import type { ContinuityStatus, RecoveryPoint } from "@/types/desktop-continuity";

export function recoveryPointReasonLabel(reason: string): string {
  const labels: Record<string, string> = {
    pre_migration: "Antes da migração",
    daily_healthy: "Ponto diário saudável",
    manual: "Ponto manual",
    pre_recovery: "Antes da recuperação",
  };
  return labels[reason] ?? reason.replaceAll("_", " ");
}

export function continuityHealthLabel(status: Pick<ContinuityStatus, "integrity" | "access">): string {
  if (!status.integrity.ok) return "Integridade comprometida";
  if (status.access.readOnly) return "Protegido em somente leitura";
  return "Saudável";
}

export function canRestoreRecoveryPoint(point: Pick<RecoveryPoint, "status" | "filePath">): boolean {
  return point.status === "available" && point.filePath.trim().length > 0;
}
