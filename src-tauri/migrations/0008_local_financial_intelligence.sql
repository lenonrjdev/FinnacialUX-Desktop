PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS financial_intelligence_preferences (
  workspace_id TEXT PRIMARY KEY NOT NULL,
  default_horizon_days INTEGER NOT NULL DEFAULT 90 CHECK (default_horizon_days IN (30, 60, 90, 365)),
  default_scenario TEXT NOT NULL DEFAULT 'expected' CHECK (default_scenario IN ('conservative', 'expected', 'optimistic')),
  anomaly_sensitivity TEXT NOT NULL DEFAULT 'balanced' CHECK (anomaly_sensitivity IN ('low', 'balanced', 'high')),
  negative_balance_threshold_cents INTEGER NOT NULL DEFAULT 0,
  include_goal_contributions INTEGER NOT NULL DEFAULT 1 CHECK (include_goal_contributions IN (0, 1)),
  updated_at TEXT NOT NULL,
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
);

INSERT OR IGNORE INTO financial_intelligence_preferences (
  workspace_id,
  default_horizon_days,
  default_scenario,
  anomaly_sensitivity,
  negative_balance_threshold_cents,
  include_goal_contributions,
  updated_at
)
SELECT id, 90, 'expected', 'balanced', 0, 1, CURRENT_TIMESTAMP
FROM workspaces;

CREATE TABLE IF NOT EXISTS financial_intelligence_scenarios (
  id TEXT PRIMARY KEY NOT NULL,
  workspace_id TEXT NOT NULL,
  name TEXT NOT NULL,
  scenario_type TEXT NOT NULL CHECK (scenario_type IN ('conservative', 'expected', 'optimistic')),
  horizon_days INTEGER NOT NULL CHECK (horizon_days IN (30, 60, 90, 365)),
  assumptions_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS financial_intelligence_scenarios_workspace_idx
  ON financial_intelligence_scenarios(workspace_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS financial_intelligence_snapshots (
  id TEXT PRIMARY KEY NOT NULL,
  workspace_id TEXT NOT NULL,
  reference_date TEXT NOT NULL,
  horizon_days INTEGER NOT NULL CHECK (horizon_days IN (30, 60, 90, 365)),
  scenario_type TEXT NOT NULL CHECK (scenario_type IN ('conservative', 'expected', 'optimistic')),
  source_checksum TEXT NOT NULL,
  result_summary_json TEXT NOT NULL,
  ending_balance_cents INTEGER NOT NULL,
  lowest_balance_cents INTEGER NOT NULL,
  first_negative_date TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS financial_intelligence_snapshots_workspace_idx
  ON financial_intelligence_snapshots(workspace_id, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS financial_intelligence_snapshots_dedup_idx
  ON financial_intelligence_snapshots(workspace_id, reference_date, horizon_days, scenario_type, source_checksum);

INSERT OR IGNORE INTO app_schema_history (version, description, applied_at)
VALUES (8, 'Projecoes, cenarios, anomalias e inteligencia financeira local explicavel', datetime('now'));
