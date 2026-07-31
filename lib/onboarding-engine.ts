import { contextualHelpTopics, onboardingSteps } from "@/content/onboarding";
import type {
  ContextualHelpTopic,
  OnboardingObservedState,
  OnboardingStepCode,
  OnboardingStepState,
} from "@/types/onboarding";

const autoCompletionRules: Record<Exclude<OnboardingStepCode, "welcome">, (observed: OnboardingObservedState) => boolean> = {
  account: (observed) => observed.accountCount > 0,
  first_record: (observed) => (
    observed.transactionCount
    + observed.payableCount
    + observed.receivableCount
  ) > 0,
  planning: (observed) => observed.budgetCount > 0 || observed.goalCount > 0,
  security: (observed) => observed.securityReady,
  backup: (observed) => observed.backupCount > 0,
};

export function createDefaultOnboardingSteps(now = new Date().toISOString()): OnboardingStepState[] {
  return onboardingSteps.map((step) => ({
    code: step.code,
    status: "pending",
    completedAt: null,
    updatedAt: now,
  }));
}

export function mergeObservedOnboardingProgress(
  stored: OnboardingStepState[],
  observed: OnboardingObservedState,
  now = new Date().toISOString(),
): OnboardingStepState[] {
  const byCode = new Map(stored.map((step) => [step.code, step]));
  return onboardingSteps.map((definition) => {
    const current = byCode.get(definition.code) ?? {
      code: definition.code,
      status: "pending" as const,
      completedAt: null,
      updatedAt: now,
    };
    if (current.status === "completed" || current.status === "skipped" || definition.code === "welcome") {
      return current;
    }
    const completed = autoCompletionRules[definition.code](observed);
    return completed
      ? { ...current, status: "completed", completedAt: now, updatedAt: now }
      : current;
  });
}

export function calculateOnboardingSummary(steps: OnboardingStepState[]) {
  const totalSteps = onboardingSteps.length;
  const completedSteps = steps.filter((step) => step.status === "completed").length;
  const nextStep = onboardingSteps.find((definition) => (
    steps.find((step) => step.code === definition.code)?.status !== "completed"
  ))?.code ?? null;
  return {
    totalSteps,
    completedSteps,
    progressPercent: Math.round((completedSteps / totalSteps) * 100),
    nextStep,
    completed: completedSteps === totalSteps,
  };
}

export function findContextualHelp(pathname: string): ContextualHelpTopic {
  const normalized = pathname.split("?")[0].split("#")[0].replace(/\/$/, "") || "/visao-geral";
  return contextualHelpTopics.find((topic) => topic.path === normalized)
    ?? contextualHelpTopics.find((topic) => normalized.startsWith(`${topic.path}/`))
    ?? contextualHelpTopics[0];
}

export function normalizeCommandQuery(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function scoreCommandSearch(
  query: string,
  command: { label: string; description: string; keywords: string[] },
  recentIndex = -1,
) {
  const normalizedQuery = normalizeCommandQuery(query);
  const label = normalizeCommandQuery(command.label);
  const description = normalizeCommandQuery(command.description);
  const keywords = normalizeCommandQuery(command.keywords.join(" "));
  let score = recentIndex >= 0 ? Math.max(0, 18 - recentIndex * 2) : 0;
  if (!normalizedQuery) return score;
  if (label === normalizedQuery) score += 120;
  else if (label.startsWith(normalizedQuery)) score += 90;
  else if (label.includes(normalizedQuery)) score += 65;
  if (keywords.includes(normalizedQuery)) score += 45;
  if (description.includes(normalizedQuery)) score += 25;
  const tokens = normalizedQuery.split(" ").filter(Boolean);
  if (!tokens.every((token) => `${label} ${description} ${keywords}`.includes(token))) return -1;
  score += tokens.length * 8;
  return score;
}
