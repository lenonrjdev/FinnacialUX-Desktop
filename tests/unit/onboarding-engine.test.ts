import { describe, expect, it } from "vitest";
import {
  calculateOnboardingSummary,
  createDefaultOnboardingSteps,
  findContextualHelp,
  mergeObservedOnboardingProgress,
  normalizeCommandQuery,
  scoreCommandSearch,
} from "@/lib/onboarding-engine";

const emptyObserved = {
  accountCount: 0,
  transactionCount: 0,
  payableCount: 0,
  receivableCount: 0,
  budgetCount: 0,
  goalCount: 0,
  backupCount: 0,
  securityReady: false,
};

describe("motor de onboarding e experiência final", () => {
  it("cria seis etapas pendentes em ordem estável", () => {
    const steps = createDefaultOnboardingSteps("2026-07-31T12:00:00.000Z");
    expect(steps.map((step) => step.code)).toEqual([
      "welcome", "account", "first_record", "planning", "security", "backup",
    ]);
    expect(steps.every((step) => step.status === "pending")).toBe(true);
  });

  it("conclui automaticamente somente etapas comprovadas pelos dados", () => {
    const steps = mergeObservedOnboardingProgress(createDefaultOnboardingSteps(), {
      ...emptyObserved,
      accountCount: 1,
      transactionCount: 2,
      goalCount: 1,
      securityReady: true,
      backupCount: 1,
    }, "2026-07-31T12:10:00.000Z");
    expect(steps.find((step) => step.code === "welcome")?.status).toBe("pending");
    expect(steps.filter((step) => step.status === "completed")).toHaveLength(5);
  });

  it("preserva etapas puladas e concluídas manualmente", () => {
    const stored = createDefaultOnboardingSteps().map((step) => (
      step.code === "planning" ? { ...step, status: "skipped" as const } : step
    ));
    const steps = mergeObservedOnboardingProgress(stored, { ...emptyObserved, budgetCount: 3 });
    expect(steps.find((step) => step.code === "planning")?.status).toBe("skipped");
  });

  it("calcula progresso e próxima etapa sem contar itens pulados como concluídos", () => {
    const steps = createDefaultOnboardingSteps().map((step, index) => ({
      ...step,
      status: index < 3 ? "completed" as const : index === 3 ? "skipped" as const : step.status,
    }));
    const summary = calculateOnboardingSummary(steps);
    expect(summary.completedSteps).toBe(3);
    expect(summary.progressPercent).toBe(50);
    expect(summary.nextStep).toBe("planning");
  });

  it("resolve ajuda contextual pela rota e usa fallback seguro", () => {
    expect(findContextualHelp("/conciliacao#fechamento").id).toBe("reconciliation");
    expect(findContextualHelp("/rota-desconhecida").id).toBe("overview");
  });

  it("normaliza acentos e prioriza comandos pelo rótulo", () => {
    const command = {
      label: "Conciliação bancária",
      description: "Importe extratos e feche o mês.",
      keywords: ["ofx", "csv", "saldo"],
    };
    expect(normalizeCommandQuery("  Conciliação! ")).toBe("conciliacao");
    expect(scoreCommandSearch("conciliacao", command)).toBeGreaterThan(scoreCommandSearch("saldo", command));
    expect(scoreCommandSearch("termo inexistente", command)).toBe(-1);
  });
});
