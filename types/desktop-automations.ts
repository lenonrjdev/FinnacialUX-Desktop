import type { TransactionStatus, TransactionType } from "@/types/lancamentos";

export type AutomationFrequency = "weekly" | "monthly" | "quarterly" | "yearly";
export type AutomationCandidateKind = "rule" | "suggestion" | "recurrence";
export type AutomationAlertKind = "payable" | "receivable" | "subscription";
export type AutomationAlertSeverity = "info" | "warning" | "critical";
export type AutomationAlertStatus = "active" | "read" | "dismissed";
export type AutomationRunStatus = "applied" | "undone" | "failed";

export interface RecurringTransactionTemplate {
  id: string;
  name: string;
  active: boolean;
  frequency: AutomationFrequency;
  interval: number;
  nextRunAt: string;
  lastRunAt?: string;
  createdAt: string;
  transaction: {
    description: string;
    category: string;
    account: string;
    paymentMethod: string;
    amount: number;
    type: TransactionType;
    status: TransactionStatus;
    note?: string;
  };
}

export type RecurringTransactionTemplateInput = Omit<
  RecurringTransactionTemplate,
  "id" | "createdAt" | "lastRunAt"
>;

export interface AutomationPreferences {
  workspaceId: string;
  simulationRequired: boolean;
  startupScanEnabled: boolean;
  dueWindowDays: number;
  alertOverdue: boolean;
  alertUpcoming: boolean;
  lastRunAt: string | null;
  updatedAt: string;
}

export interface AutomationCandidate {
  id: string;
  kind: AutomationCandidateKind;
  title: string;
  description: string;
  targetModule: string;
  targetId: string;
  ruleId: string | null;
  templateId: string | null;
  occurrenceDate: string | null;
  before: Record<string, unknown> | null;
  after: Record<string, unknown>;
}

export interface AutomationAlert {
  id: string;
  kind: AutomationAlertKind;
  severity: AutomationAlertSeverity;
  status: AutomationAlertStatus;
  title: string;
  message: string;
  targetModule: string;
  targetId: string;
  dueAt: string;
  daysUntilDue: number;
}

export interface AutomationPreviewSummary {
  ruleChanges: number;
  learnedSuggestions: number;
  recurringTransactions: number;
  alerts: number;
  totalCandidates: number;
}

export interface AutomationPreview {
  previewId: string;
  sourceChecksum: string;
  referenceDate: string;
  generatedAt: string;
  candidates: AutomationCandidate[];
  alerts: AutomationAlert[];
  summary: AutomationPreviewSummary;
}

export interface AutomationRun {
  id: string;
  workspaceId: string;
  status: AutomationRunStatus;
  referenceDate: string;
  candidatesTotal: number;
  changesApplied: number;
  skippedTotal: number;
  affectedModules: string[];
  createdAt: string;
  completedAt: string | null;
  undoneAt: string | null;
  reversible: boolean;
  errorMessage: string | null;
}

export interface ApplyAutomationRequest {
  workspaceId: string;
  sourceChecksum: string;
  referenceDate: string;
  selectedCandidateIds: string[];
}
