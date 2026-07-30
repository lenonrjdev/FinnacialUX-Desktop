PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS financial_planning_preferences (
  workspace_id TEXT PRIMARY KEY NOT NULL,
  default_period TEXT NOT NULL DEFAULT 'monthly' CHECK (default_period IN ('monthly', 'annual')),
  default_debt_strategy TEXT NOT NULL DEFAULT 'avalanche' CHECK (default_debt_strategy IN ('avalanche', 'snowball', 'priority')),
  default_reserve_target_months REAL NOT NULL DEFAULT 6 CHECK (default_reserve_target_months BETWEEN 1 AND 24),
  monthly_review_day INTEGER NOT NULL DEFAULT 25 CHECK (monthly_review_day BETWEEN 1 AND 28),
  require_simulation_before_activation INTEGER NOT NULL DEFAULT 1 CHECK (require_simulation_before_activation IN (0, 1)),
  updated_at TEXT NOT NULL,
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
);

INSERT OR IGNORE INTO financial_planning_preferences (
  workspace_id, default_period, default_debt_strategy, default_reserve_target_months,
  monthly_review_day, require_simulation_before_activation, updated_at
)
SELECT id, 'monthly', 'avalanche', 6, 25, 1, CURRENT_TIMESTAMP
FROM workspaces;

CREATE TABLE IF NOT EXISTS financial_plans (
  id TEXT PRIMARY KEY NOT NULL,
  workspace_id TEXT NOT NULL,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'archived')),
  period TEXT NOT NULL CHECK (period IN ('monthly', 'annual')),
  start_month TEXT NOT NULL,
  end_month TEXT NOT NULL,
  draft_json TEXT NOT NULL,
  simulation_summary_json TEXT NOT NULL,
  source_checksum TEXT NOT NULL,
  projection_checksum TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  activated_at TEXT,
  archived_at TEXT,
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS financial_plans_workspace_idx
  ON financial_plans(workspace_id, status, updated_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS financial_plans_one_active_idx
  ON financial_plans(workspace_id)
  WHERE status = 'active';

CREATE TABLE IF NOT EXISTS financial_plan_reviews (
  id TEXT PRIMARY KEY NOT NULL,
  workspace_id TEXT NOT NULL,
  plan_id TEXT NOT NULL,
  review_month TEXT NOT NULL,
  source_checksum TEXT NOT NULL,
  summary_json TEXT NOT NULL,
  deviations_json TEXT NOT NULL,
  accepted_adjustments_json TEXT NOT NULL DEFAULT '[]',
  notes TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
  FOREIGN KEY (plan_id) REFERENCES financial_plans(id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS financial_plan_reviews_month_idx
  ON financial_plan_reviews(plan_id, review_month);

CREATE INDEX IF NOT EXISTS financial_plan_reviews_workspace_idx
  ON financial_plan_reviews(workspace_id, created_at DESC);

CREATE TABLE IF NOT EXISTS financial_planning_decisions (
  id TEXT PRIMARY KEY NOT NULL,
  workspace_id TEXT NOT NULL,
  plan_id TEXT,
  title TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('review', 'debt', 'goal', 'budget', 'reserve', 'commitment')),
  decision_date TEXT NOT NULL,
  amount_cents INTEGER,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'dismissed')),
  notes TEXT NOT NULL DEFAULT '',
  generated INTEGER NOT NULL DEFAULT 0 CHECK (generated IN (0, 1)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
  FOREIGN KEY (plan_id) REFERENCES financial_plans(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS financial_planning_decisions_workspace_idx
  ON financial_planning_decisions(workspace_id, status, decision_date ASC);

CREATE INDEX IF NOT EXISTS financial_planning_decisions_plan_idx
  ON financial_planning_decisions(plan_id, decision_date ASC);

INSERT OR IGNORE INTO app_schema_history (version, description, applied_at)
VALUES (9, 'Planos financeiros, revisoes mensais e calendario de decisoes locais', datetime('now'));
