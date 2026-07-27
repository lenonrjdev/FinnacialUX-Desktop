export type DataToolsView = "import" | "export" | "rules" | "history";
export type ImportSourceType = "csv" | "ofx";
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

export type ExportFormat = "csv" | "json";
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
