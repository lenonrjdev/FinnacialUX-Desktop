PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS reconciliation_preferences (
  workspace_id TEXT PRIMARY KEY NOT NULL,
  date_tolerance_days INTEGER NOT NULL DEFAULT 2 CHECK (date_tolerance_days BETWEEN 0 AND 7),
  amount_tolerance_cents INTEGER NOT NULL DEFAULT 1 CHECK (amount_tolerance_cents BETWEEN 0 AND 1000),
  auto_match_threshold INTEGER NOT NULL DEFAULT 85 CHECK (auto_match_threshold BETWEEN 50 AND 100),
  closing_tolerance_cents INTEGER NOT NULL DEFAULT 1 CHECK (closing_tolerance_cents BETWEEN 0 AND 10000),
  require_preview_before_apply INTEGER NOT NULL DEFAULT 1 CHECK (require_preview_before_apply IN (0, 1)),
  require_complete_checklist INTEGER NOT NULL DEFAULT 1 CHECK (require_complete_checklist IN (0, 1)),
  updated_at TEXT NOT NULL,
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
);

INSERT OR IGNORE INTO reconciliation_preferences (
  workspace_id, date_tolerance_days, amount_tolerance_cents, auto_match_threshold,
  closing_tolerance_cents, require_preview_before_apply, require_complete_checklist, updated_at
)
SELECT id, 2, 1, 85, 1, 1, 1, CURRENT_TIMESTAMP
FROM workspaces;

CREATE TABLE IF NOT EXISTS bank_statement_imports (
  id TEXT PRIMARY KEY NOT NULL,
  workspace_id TEXT NOT NULL,
  account_id TEXT NOT NULL,
  account_name TEXT NOT NULL,
  file_name TEXT NOT NULL,
  source_type TEXT NOT NULL CHECK (source_type IN ('csv', 'ofx')),
  checksum_sha256 TEXT NOT NULL,
  preview_checksum TEXT NOT NULL,
  period_start TEXT NOT NULL,
  period_end TEXT NOT NULL,
  opening_balance_cents INTEGER NOT NULL DEFAULT 0,
  closing_balance_cents INTEGER NOT NULL DEFAULT 0,
  entries_count INTEGER NOT NULL DEFAULT 0,
  matched_count INTEGER NOT NULL DEFAULT 0,
  created_count INTEGER NOT NULL DEFAULT 0,
  ignored_count INTEGER NOT NULL DEFAULT 0,
  duplicate_count INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL CHECK (status IN ('preview', 'applied', 'partial', 'undone')),
  before_transactions_json TEXT NOT NULL,
  after_transactions_checksum TEXT NOT NULL,
  reversible INTEGER NOT NULL DEFAULT 1 CHECK (reversible IN (0, 1)),
  imported_at TEXT NOT NULL,
  applied_at TEXT,
  undone_at TEXT,
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS bank_statement_imports_workspace_idx
  ON bank_statement_imports(workspace_id, imported_at DESC);
CREATE INDEX IF NOT EXISTS bank_statement_imports_account_period_idx
  ON bank_statement_imports(workspace_id, account_id, period_start, period_end);
CREATE UNIQUE INDEX IF NOT EXISTS bank_statement_imports_checksum_idx
  ON bank_statement_imports(workspace_id, account_id, checksum_sha256)
  WHERE status != 'undone';

CREATE TABLE IF NOT EXISTS bank_statement_entries (
  id TEXT PRIMARY KEY NOT NULL,
  import_id TEXT NOT NULL,
  workspace_id TEXT NOT NULL,
  source_entry_id TEXT NOT NULL,
  external_id TEXT,
  posted_at TEXT NOT NULL,
  description TEXT NOT NULL,
  memo TEXT,
  amount_cents INTEGER NOT NULL,
  direction TEXT NOT NULL CHECK (direction IN ('income', 'expense')),
  fingerprint TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('ready', 'matched', 'created', 'ignored', 'duplicate', 'undone')),
  matched_transaction_id TEXT,
  match_score INTEGER,
  decision_note TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  FOREIGN KEY (import_id) REFERENCES bank_statement_imports(id) ON DELETE CASCADE,
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS bank_statement_entries_import_idx
  ON bank_statement_entries(import_id, posted_at ASC);
CREATE INDEX IF NOT EXISTS bank_statement_entries_workspace_date_idx
  ON bank_statement_entries(workspace_id, posted_at, status);
CREATE INDEX IF NOT EXISTS bank_statement_entries_external_idx
  ON bank_statement_entries(workspace_id, external_id)
  WHERE external_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS reconciliation_matches (
  id TEXT PRIMARY KEY NOT NULL,
  workspace_id TEXT NOT NULL,
  import_id TEXT NOT NULL,
  entry_id TEXT NOT NULL,
  transaction_id TEXT,
  action TEXT NOT NULL CHECK (action IN ('match', 'create', 'ignore')),
  status TEXT NOT NULL CHECK (status IN ('applied', 'undone')),
  score INTEGER,
  reasons_json TEXT NOT NULL DEFAULT '{}',
  matched_at TEXT NOT NULL,
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
  FOREIGN KEY (import_id) REFERENCES bank_statement_imports(id) ON DELETE CASCADE,
  FOREIGN KEY (entry_id) REFERENCES bank_statement_entries(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS reconciliation_matches_workspace_idx
  ON reconciliation_matches(workspace_id, matched_at DESC);

CREATE TABLE IF NOT EXISTS monthly_financial_closures (
  id TEXT PRIMARY KEY NOT NULL,
  workspace_id TEXT NOT NULL,
  account_id TEXT NOT NULL,
  account_name TEXT NOT NULL,
  month TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'closed', 'reopened')),
  opening_balance_cents INTEGER NOT NULL,
  movements_cents INTEGER NOT NULL,
  calculated_balance_cents INTEGER NOT NULL,
  statement_balance_cents INTEGER NOT NULL,
  difference_cents INTEGER NOT NULL,
  checklist_json TEXT NOT NULL,
  source_checksum TEXT NOT NULL,
  notes TEXT NOT NULL DEFAULT '',
  closed_at TEXT,
  reopened_at TEXT,
  reopening_reason TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
  UNIQUE (workspace_id, account_id, month)
);

CREATE INDEX IF NOT EXISTS monthly_financial_closures_workspace_idx
  ON monthly_financial_closures(workspace_id, month DESC, account_id);
CREATE INDEX IF NOT EXISTS monthly_financial_closures_status_idx
  ON monthly_financial_closures(workspace_id, status, month DESC);

CREATE TABLE IF NOT EXISTS monthly_closure_events (
  id TEXT PRIMARY KEY NOT NULL,
  workspace_id TEXT NOT NULL,
  closure_id TEXT NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('created', 'closed', 'reopened', 'adjustment')),
  details_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
  FOREIGN KEY (closure_id) REFERENCES monthly_financial_closures(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS monthly_closure_events_closure_idx
  ON monthly_closure_events(closure_id, created_at DESC);

CREATE TABLE IF NOT EXISTS reconciliation_evidence (
  id TEXT PRIMARY KEY NOT NULL,
  workspace_id TEXT NOT NULL,
  transaction_id TEXT NOT NULL,
  note TEXT NOT NULL DEFAULT '',
  file_name TEXT,
  mime_type TEXT,
  content_blob BLOB,
  size_bytes INTEGER NOT NULL DEFAULT 0,
  checksum_sha256 TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS reconciliation_evidence_transaction_idx
  ON reconciliation_evidence(workspace_id, transaction_id, created_at DESC);

INSERT OR IGNORE INTO app_schema_history (version, description, applied_at)
VALUES (10, 'Conciliacao de extratos, comprovantes e fechamento financeiro mensal auditavel', datetime('now'));
