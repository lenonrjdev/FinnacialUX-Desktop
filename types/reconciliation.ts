import type { ImportParseResult, CsvMapping } from "@/types/dados-e-automacoes";

export type ReconciliationSourceType = "csv" | "ofx";
export type ReconciliationEntryStatus = "ready" | "matched" | "created" | "ignored" | "duplicate" | "undone";
export type ReconciliationDecisionAction = "match" | "create" | "ignore";
export type ReconciliationImportStatus = "preview" | "applied" | "partial" | "undone";
export type MonthlyClosureStatus = "draft" | "closed" | "reopened";
export type ClosureEventAction = "created" | "closed" | "reopened" | "adjustment";

export type ReconciliationPreferences = {
  workspaceId: string;
  dateToleranceDays: number;
  amountToleranceCents: number;
  autoMatchThreshold: number;
  closingToleranceCents: number;
  requirePreviewBeforeApply: boolean;
  requireCompleteChecklist: boolean;
  updatedAt: string;
};

export type SaveReconciliationPreferencesRequest = Omit<ReconciliationPreferences, "workspaceId" | "updatedAt">;

export type StatementEntryInput = {
  id: string;
  externalId?: string;
  postedAt: string;
  description: string;
  amount: number;
  direction: "income" | "expense";
  memo?: string;
  fingerprint: string;
};

export type ReconciliationMatchReason = {
  amount: string;
  date: string;
  description: string;
  account: string;
};

export type ReconciliationMatchOption = {
  transactionId: string;
  transactionDescription: string;
  transactionDate: string;
  transactionAmount: number;
  score: number;
  reasons: ReconciliationMatchReason;
};

export type ReconciliationEntryPreview = {
  entry: StatementEntryInput;
  status: "ready" | "duplicate" | "review";
  suggestedAction: ReconciliationDecisionAction;
  suggestedTransactionId?: string;
  options: ReconciliationMatchOption[];
  issues: string[];
};

export type ReconciliationPreviewSummary = {
  entries: number;
  suggestedMatches: number;
  newTransactions: number;
  duplicates: number;
  needsReview: number;
  totalIncome: number;
  totalExpenses: number;
};

export type ReconciliationPreview = {
  sourceChecksum: string;
  previewChecksum: string;
  accountId: string;
  accountName: string;
  fileName: string;
  sourceType: ReconciliationSourceType;
  periodStart: string;
  periodEnd: string;
  entries: ReconciliationEntryPreview[];
  summary: ReconciliationPreviewSummary;
};

export type PreviewReconciliationImportRequest = {
  accountId: string;
  accountName: string;
  fileName: string;
  sourceType: ReconciliationSourceType;
  entries: StatementEntryInput[];
};

export type ReconciliationDecision = {
  entryId: string;
  action: ReconciliationDecisionAction;
  transactionId?: string;
  category?: string;
  note?: string;
};

export type ApplyReconciliationImportRequest = PreviewReconciliationImportRequest & {
  openingBalance: number;
  closingBalance: number;
  sourceChecksum: string;
  previewChecksum: string;
  decisions: ReconciliationDecision[];
};

export type ReconciliationImportRecord = {
  id: string;
  workspaceId: string;
  accountId: string;
  accountName: string;
  fileName: string;
  sourceType: ReconciliationSourceType;
  checksumSha256: string;
  previewChecksum: string;
  periodStart: string;
  periodEnd: string;
  openingBalance: number;
  closingBalance: number;
  entriesCount: number;
  matchedCount: number;
  createdCount: number;
  ignoredCount: number;
  duplicateCount: number;
  status: ReconciliationImportStatus;
  reversible: boolean;
  importedAt: string;
  appliedAt?: string;
  undoneAt?: string;
};

export type ReconciliationImportPreparation = {
  parseResult: ImportParseResult;
  mapping: CsvMapping;
  entries: StatementEntryInput[];
};

export type ClosureChecklist = {
  statementImported: boolean;
  allEntriesResolved: boolean;
  balanceReviewed: boolean;
  pendingCommitmentsReviewed: boolean;
  evidenceReviewed: boolean;
};

export type ClosurePreviewRequest = {
  accountId: string;
  accountName: string;
  month: string;
  openingBalance: number;
  statementBalance: number;
  checklist: ClosureChecklist;
};

export type ClosureMovementSummary = {
  income: number;
  expenses: number;
  transfersIn: number;
  transfersOut: number;
  net: number;
  transactions: number;
};

export type MonthlyClosurePreview = {
  accountId: string;
  accountName: string;
  month: string;
  openingBalance: number;
  movements: ClosureMovementSummary;
  calculatedBalance: number;
  statementBalance: number;
  difference: number;
  unresolvedEntries: number;
  checklist: ClosureChecklist;
  sourceChecksum: string;
  canClose: boolean;
  blockers: string[];
};

export type CloseMonthRequest = ClosurePreviewRequest & {
  sourceChecksum: string;
  notes?: string;
};

export type MonthlyClosure = {
  id: string;
  workspaceId: string;
  accountId: string;
  accountName: string;
  month: string;
  status: MonthlyClosureStatus;
  openingBalance: number;
  movements: number;
  calculatedBalance: number;
  statementBalance: number;
  difference: number;
  checklist: ClosureChecklist;
  sourceChecksum: string;
  notes: string;
  closedAt?: string;
  reopenedAt?: string;
  reopeningReason?: string;
  createdAt: string;
  updatedAt: string;
};

export type ReopenMonthRequest = {
  closureId: string;
  reason: string;
};

export type ClosureEvent = {
  id: string;
  workspaceId: string;
  closureId: string;
  action: ClosureEventAction;
  details: Record<string, unknown>;
  createdAt: string;
};

export type ReconciliationEvidence = {
  id: string;
  workspaceId: string;
  transactionId: string;
  note: string;
  fileName?: string;
  mimeType?: string;
  sizeBytes: number;
  checksumSha256?: string;
  createdAt: string;
};

export type ReconciliationEvidenceFile = {
  fileName: string;
  mimeType: string;
  bytes: number[];
  checksumSha256: string;
};

export type SaveReconciliationEvidenceRequest = {
  transactionId: string;
  note: string;
  fileName?: string;
  mimeType?: string;
  bytes?: number[];
};
