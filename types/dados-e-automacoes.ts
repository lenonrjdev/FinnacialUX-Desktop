export type DataToolsView = "automations" | "recurrences" | "import" | "export" | "portability" | "rules" | "history";
export type ImportSourceType = "csv" | "ofx" | "xlsx" | "xls" | "json" | "fuxportable";
export type ImportRowType = "income" | "expense" | "transfer";
export type ImportRowStatus = "ready" | "review" | "duplicate";

export type CsvField =
  | "ignore"
  | "date"
  | "description"
  | "amount"
  | "type"
  | "category"
  | "account";

export type CsvMapping = Record<string, CsvField>;

export interface RawImportRecord {
  [key: string]: string;
}

export interface ImportParseResult {
  sourceType: ImportSourceType;
  fileName: string;
  headers: string[];
  records: RawImportRecord[];
  worksheetNames?: string[];
  selectedWorksheet?: string;
}

export interface ImportTransactionRow {
  id: string;
  date: string;
  description: string;
  amount: number;
  type: ImportRowType;
  category: string;
  account: string;
  selected: boolean;
  status: ImportRowStatus;
  issues: string[];
  original: RawImportRecord;
}

export interface ImportHistoryItem {
  id: string;
  fileName: string;
  sourceType: ImportSourceType;
  importedAt: string;
  importedRows: number;
  ignoredRows: number;
  duplicateRows: number;
  status: "completed" | "partial";
  operationId?: string;
  reversible?: boolean;
  undoneAt?: string;
}

export type ExportDataset =
  | "transactions"
  | "accounts"
  | "cards"
  | "payables"
  | "receivables"
  | "budgets"
  | "goals"
  | "debts"
  | "subscriptions"
  | "full-backup";

export type ExportFormat = "csv" | "json" | "xlsx";
export type ExportSeparator = ";" | ",";

export interface ExportConfiguration {
  dataset: ExportDataset;
  format: ExportFormat;
  separator: ExportSeparator;
  startDate: string;
  endDate: string;
  includeHeaders: boolean;
}

export interface ExportTable {
  headers: readonly string[];
  rows: Array<Array<string | number | boolean>>;
  fileBase: string;
}

export type RuleField = "description" | "category" | "account";
export type RuleOperator = "contains" | "starts-with" | "equals";

export interface AutomationRuleActions {
  category?: string;
  account?: string;
  type?: ImportRowType;
}

export interface AutomationRule {
  id: string;
  name: string;
  active: boolean;
  priority: number;
  field: RuleField;
  operator: RuleOperator;
  value: string;
  actions: AutomationRuleActions;
  createdAt: string;
}

export type AutomationRuleInput = Omit<AutomationRule, "id" | "createdAt" | "priority">;

export interface RuleTestResult {
  ruleId: string;
  matches: number;
  examples: string[];
}

export type PortabilityDirection = "import" | "export" | "transfer" | "undo";
export type PortabilityStatus = "completed" | "partial" | "failed" | "undone";
export type PortableImportMode = "merge" | "replace";

export interface PortabilityOperation {
  id: string;
  workspaceId: string;
  direction: PortabilityDirection;
  format: string;
  dataset: string;
  fileName: string;
  checksumSha256: string | null;
  recordsTotal: number;
  recordsApplied: number;
  recordsRejected: number;
  affectedModules: string[];
  status: PortabilityStatus;
  reversible: boolean;
  createdAt: string;
  completedAt: string | null;
  errorMessage: string | null;
}

export interface PortabilityOperationInput {
  id?: string;
  direction: PortabilityDirection;
  format: string;
  dataset: string;
  fileName: string;
  checksumSha256?: string | null;
  recordsTotal?: number;
  recordsApplied?: number;
  recordsRejected?: number;
  affectedModules?: string[];
  status?: PortabilityStatus;
  reversible?: boolean;
  errorMessage?: string | null;
}

export interface PortablePackagePayload {
  product: "FinnacialUX Desktop";
  formatVersion: 1;
  appVersion: string;
  exportedAt: string;
  sourceWorkspaceId: string;
  documents: Record<string, unknown>;
  documentChecksums: Record<string, string>;
  totals: {
    modules: number;
    records: number;
  };
}

export interface PortablePackageEnvelope {
  magic: "FUXPORTABLE1";
  formatVersion: 1;
  encrypted: true;
  algorithm: "PBKDF2-SHA256+AES-256-GCM";
  kdf: {
    iterations: number;
    saltB64: string;
  };
  cipher: {
    ivB64: string;
  };
  payloadChecksumSha256: string;
  encryptedPayloadB64: string;
}

export interface PortableImportPreview {
  fileName: string;
  appVersion: string;
  exportedAt: string;
  sourceWorkspaceId: string;
  modules: string[];
  records: number;
  checksumSha256: string;
  documents: Record<string, unknown>;
}

export interface PortabilityTemplate {
  id: string;
  title: string;
  description: string;
  format: "csv" | "xlsx";
  fileName: string;
}
