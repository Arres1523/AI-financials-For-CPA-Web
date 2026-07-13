import Database from "better-sqlite3";
import path from "path";

const DB_PATH = path.join(process.cwd(), "data", "app.db");

let _db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (_db) return _db;
  const fs = require("fs");
  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  _db = new Database(DB_PATH);
  _db.pragma("journal_mode = WAL");
  _db.pragma("foreign_keys = ON");
  migrate(_db);
  return _db;
}

function migrate(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS companies (
      id TEXT PRIMARY KEY,
      legal_name TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE UNIQUE INDEX IF NOT EXISTS idx_companies_name ON companies(legal_name);

    CREATE TABLE IF NOT EXISTS workspaces (
      id TEXT PRIMARY KEY,
      company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
      tax_year INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'in_progress',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(company_id, tax_year)
    );

    CREATE TABLE IF NOT EXISTS bank_accounts (
      id TEXT PRIMARY KEY,
      company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
      account_name TEXT NOT NULL,
      bank_name TEXT NOT NULL,
      last_four TEXT NOT NULL,
      account_type TEXT NOT NULL DEFAULT 'Checking',
      opening_balance REAL DEFAULT 0,
      closing_balance REAL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS uploaded_statements (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
      bank_account_id TEXT NOT NULL REFERENCES bank_accounts(id) ON DELETE CASCADE,
      file_name TEXT NOT NULL,
      sheet_name TEXT,
      total_rows INTEGER DEFAULT 0,
      imported_rows INTEGER DEFAULT 0,
      uploaded_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS transactions (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
      bank_account_id TEXT NOT NULL REFERENCES bank_accounts(id) ON DELETE CASCADE,
      statement_id TEXT NOT NULL REFERENCES uploaded_statements(id) ON DELETE CASCADE,
      date TEXT NOT NULL,
      description TEXT NOT NULL,
      amount REAL NOT NULL,
      balance REAL,
      original_row_index INTEGER,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_transactions_workspace ON transactions(workspace_id);
    CREATE INDEX IF NOT EXISTS idx_transactions_account ON transactions(bank_account_id);

    CREATE TABLE IF NOT EXISTS classifications (
      id TEXT PRIMARY KEY,
      transaction_id TEXT NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
      final_category TEXT NOT NULL,
      report_type TEXT NOT NULL CHECK(report_type IN ('P&L', 'Balance Sheet')),
      confidence TEXT NOT NULL CHECK(confidence IN ('high', 'medium', 'low')),
      rule_used TEXT,
      review_status TEXT NOT NULL DEFAULT 'pending' CHECK(review_status IN ('pending', 'approved', 'excluded')),
      is_manual_correction INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_classifications_transaction ON classifications(transaction_id);
    CREATE INDEX IF NOT EXISTS idx_classifications_review ON classifications(review_status);

    CREATE TABLE IF NOT EXISTS classification_rules (
      id TEXT PRIMARY KEY,
      pattern TEXT NOT NULL,
      category TEXT NOT NULL,
      report_type TEXT NOT NULL CHECK(report_type IN ('P&L', 'Balance Sheet')),
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS review_events (
      id TEXT PRIMARY KEY,
      transaction_id TEXT NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
      action TEXT NOT NULL CHECK(action IN ('approve','reject','exclude','change_category')),
      previous_category TEXT,
      new_category TEXT,
      note TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS report_exports (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
      export_type TEXT NOT NULL CHECK(export_type IN ('financial_only','with_transactions')),
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
}
