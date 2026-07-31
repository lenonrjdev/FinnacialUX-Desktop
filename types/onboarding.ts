export type OnboardingStepCode =
  | "welcome"
  | "account"
  | "first_record"
  | "planning"
  | "security"
  | "backup";

export type OnboardingStepStatus = "pending" | "completed" | "skipped";

export type OnboardingPreferences = {
  workspaceId: string;
  autoOpen: boolean;
  showProgressDock: boolean;
  contextualHelpEnabled: boolean;
  completedAt: string | null;
  skippedAt: string | null;
  updatedAt: string;
};

export type OnboardingStepState = {
  code: OnboardingStepCode;
  status: OnboardingStepStatus;
  completedAt: string | null;
  updatedAt: string;
};

export type OnboardingState = {
  preferences: OnboardingPreferences;
  steps: OnboardingStepState[];
  progressPercent: number;
  completedSteps: number;
  totalSteps: number;
  nextStep: OnboardingStepCode | null;
  completed: boolean;
  skipped: boolean;
  persisted: boolean;
  readOnly: boolean;
};

export type OnboardingObservedState = {
  accountCount: number;
  transactionCount: number;
  payableCount: number;
  receivableCount: number;
  budgetCount: number;
  goalCount: number;
  backupCount: number;
  securityReady: boolean;
};

export type OnboardingSyncRequest = {
  workspaceId: string;
  observed: OnboardingObservedState;
};

export type OnboardingStepRequest = {
  workspaceId: string;
  stepCode: OnboardingStepCode;
};

export type SaveOnboardingPreferencesRequest = {
  workspaceId: string;
  autoOpen: boolean;
  showProgressDock: boolean;
  contextualHelpEnabled: boolean;
};

export type OnboardingSkipRequest = {
  workspaceId: string;
  reason?: string;
};

export type OnboardingStepDefinition = {
  code: OnboardingStepCode;
  eyebrow: string;
  title: string;
  description: string;
  actionLabel: string;
  href: string;
  automatic: boolean;
};

export type ContextualHelpTopic = {
  id: string;
  path: string;
  title: string;
  summary: string;
  steps: string[];
  related: Array<{ label: string; href: string }>;
};
