CREATE TABLE IF NOT EXISTS opening_balance_entries (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id),
  account_name TEXT NOT NULL,
  account_type TEXT NOT NULL CHECK (account_type IN ('asset', 'liability', 'equity')),
  amount REAL NOT NULL DEFAULT 0,
  source TEXT NOT NULL DEFAULT 'manual',
  support_status TEXT NOT NULL DEFAULT 'provided' CHECK (support_status IN ('provided', 'missing', 'reviewed')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_opening_balance_entries_workspace ON opening_balance_entries(workspace_id);
