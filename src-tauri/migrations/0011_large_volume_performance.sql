-- FinnacialUX Desktop 0.14.0
-- Schema 11: desempenho, paginação nativa, índices derivados e operações canceláveis.

CREATE TABLE IF NOT EXISTS performance_preferences (
  workspace_id TEXT PRIMARY KEY,
  transaction_page_size INTEGER NOT NULL DEFAULT 50 CHECK (transaction_page_size BETWEEN 25 AND 250),
  import_batch_size INTEGER NOT NULL DEFAULT 500 CHECK (import_batch_size BETWEEN 100 AND 2000),
  query_timeout_ms INTEGER NOT NULL DEFAULT 250 CHECK (query_timeout_ms BETWEEN 50 AND 10000),
  auto_analyze INTEGER NOT NULL DEFAULT 1 CHECK (auto_analyze IN (0, 1)),
  last_analyze_at TEXT,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS finance_transaction_index (
  workspace_id TEXT NOT NULL,
  transaction_id TEXT NOT NULL,
  transaction_date TEXT NOT NULL,
  description TEXT NOT NULL,
  normalized_description TEXT NOT NULL,
  category TEXT NOT NULL,
  account_id TEXT NOT NULL,
  account_name TEXT NOT NULL,
  destination_account_id TEXT,
  amount_cents INTEGER NOT NULL,
  transaction_type TEXT NOT NULL,
  transaction_status TEXT NOT NULL,
  source_type TEXT,
  reconciled INTEGER NOT NULL DEFAULT 0 CHECK (reconciled IN (0, 1)),
  data_json TEXT NOT NULL,
  indexed_at TEXT NOT NULL,
  PRIMARY KEY (workspace_id, transaction_id),
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_transaction_index_workspace_date
  ON finance_transaction_index(workspace_id, transaction_date DESC, transaction_id DESC);
CREATE INDEX IF NOT EXISTS idx_transaction_index_workspace_type_date
  ON finance_transaction_index(workspace_id, transaction_type, transaction_date DESC);
CREATE INDEX IF NOT EXISTS idx_transaction_index_workspace_status_date
  ON finance_transaction_index(workspace_id, transaction_status, transaction_date DESC);
CREATE INDEX IF NOT EXISTS idx_transaction_index_workspace_account_date
  ON finance_transaction_index(workspace_id, account_id, transaction_date DESC);
CREATE INDEX IF NOT EXISTS idx_transaction_index_workspace_category_date
  ON finance_transaction_index(workspace_id, category, transaction_date DESC);
CREATE INDEX IF NOT EXISTS idx_transaction_index_workspace_description
  ON finance_transaction_index(workspace_id, normalized_description);

CREATE TABLE IF NOT EXISTS performance_index_state (
  workspace_id TEXT PRIMARY KEY,
  source_checksum TEXT NOT NULL,
  source_updated_at TEXT NOT NULL,
  item_count INTEGER NOT NULL DEFAULT 0,
  indexed_at TEXT NOT NULL,
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS performance_operation_jobs (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('transaction_index', 'reconciliation_import', 'database_maintenance', 'benchmark')),
  status TEXT NOT NULL CHECK (status IN ('queued', 'running', 'completed', 'cancelled', 'failed')),
  progress_current INTEGER NOT NULL DEFAULT 0,
  progress_total INTEGER NOT NULL DEFAULT 0,
  cancellation_requested INTEGER NOT NULL DEFAULT 0 CHECK (cancellation_requested IN (0, 1)),
  details_json TEXT NOT NULL DEFAULT '{}',
  error_message TEXT,
  started_at TEXT,
  completed_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_performance_jobs_workspace_status
  ON performance_operation_jobs(workspace_id, status, updated_at DESC);

CREATE TABLE IF NOT EXISTS performance_operation_metrics (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  operation_type TEXT NOT NULL,
  item_count INTEGER NOT NULL DEFAULT 0,
  duration_ms INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL CHECK (status IN ('success', 'cancelled', 'failed')),
  cancelled INTEGER NOT NULL DEFAULT 0 CHECK (cancelled IN (0, 1)),
  details_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_performance_metrics_workspace_created
  ON performance_operation_metrics(workspace_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_bank_statement_entries_import_posted
  ON bank_statement_entries(import_id, posted_at, id);
CREATE INDEX IF NOT EXISTS idx_bank_statement_imports_workspace_period
  ON bank_statement_imports(workspace_id, period_start DESC, period_end DESC);
CREATE INDEX IF NOT EXISTS idx_closures_workspace_month_account
  ON monthly_financial_closures(workspace_id, month DESC, account_id);
CREATE INDEX IF NOT EXISTS idx_automation_runs_workspace_created
  ON automation_runs(workspace_id, created_at DESC);

PRAGMA user_version = 11;
