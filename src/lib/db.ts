import { Pool, PoolClient } from "pg";

let _pool: Pool | null = null;
let _initPromise: Promise<void> | null = null;

function getConnectionString(): string {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL environment variable is not configured");
  }
  return url;
}

const MIGRATIONS: [string, string][] = [
  ["v1_initial", `
    CREATE TABLE IF NOT EXISTS companies (
      id TEXT PRIMARY KEY,
      legal_name TEXT NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_companies_name ON companies(legal_name);

    CREATE TABLE IF NOT EXISTS workspaces (
      id TEXT PRIMARY KEY,
      company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
      tax_year INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'in_progress',
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
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
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS uploaded_statements (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
      bank_account_id TEXT NOT NULL REFERENCES bank_accounts(id) ON DELETE CASCADE,
      file_name TEXT NOT NULL,
      sheet_name TEXT,
      total_rows INTEGER DEFAULT 0,
      imported_rows INTEGER DEFAULT 0,
      file_hash TEXT,
      uploaded_at TIMESTAMP NOT NULL DEFAULT NOW()
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
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
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
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_classifications_transaction ON classifications(transaction_id);
    CREATE INDEX IF NOT EXISTS idx_classifications_review ON classifications(review_status);

    CREATE TABLE IF NOT EXISTS classification_rules (
      id TEXT PRIMARY KEY,
      company_id TEXT NOT NULL DEFAULT '',
      pattern TEXT NOT NULL,
      category TEXT NOT NULL,
      report_type TEXT NOT NULL CHECK(report_type IN ('P&L', 'Balance Sheet')),
      priority INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_classification_rules_company ON classification_rules(company_id);

    CREATE TABLE IF NOT EXISTS review_events (
      id TEXT PRIMARY KEY,
      transaction_id TEXT NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
      action TEXT NOT NULL CHECK(action IN ('approve','reject','exclude','change_category')),
      previous_category TEXT,
      new_category TEXT,
      note TEXT,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS report_exports (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
      export_type TEXT NOT NULL CHECK(export_type IN ('financial_only','with_transactions')),
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
  `],
  ["v2_duplicate_fingerprint", `
    CREATE INDEX IF NOT EXISTS idx_uploaded_statements_hash ON uploaded_statements(workspace_id, file_hash);
    CREATE INDEX IF NOT EXISTS idx_transactions_fingerprint ON transactions(workspace_id, bank_account_id, date, amount);
  `],
];

async function initialize(): Promise<void> {
  const url = getConnectionString();
  _pool = new Pool({ connectionString: url, max: 5 });
  _pool.on("error", (err) => {
    console.error("Unexpected pool error", err);
  });

  await _pool.query(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      applied_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
  `);

  const { rows } = await _pool.query("SELECT name FROM _migrations");
  const applied = new Set<string>(rows.map((r: any) => r.name));

  for (const [name, sql] of MIGRATIONS) {
    if (!applied.has(name)) {
      await _pool.query(sql);
      await _pool.query(
        "INSERT INTO _migrations (name) VALUES ($1) ON CONFLICT (name) DO NOTHING",
        [name]
      );
    }
  }
}

export async function getPool(): Promise<Pool> {
  if (_pool) return _pool;
  if (!_initPromise) {
    _initPromise = initialize();
  }
  await _initPromise;
  return _pool!;
}

export async function query(sql: string, params?: unknown[]): Promise<any[]> {
  const pool = await getPool();
  const result = await pool.query(sql, params);
  return result.rows;
}

export async function queryOne(sql: string, params?: unknown[]): Promise<any | null> {
  const rows = await query(sql, params);
  return rows[0] ?? null;
}

export async function execute(sql: string, params?: unknown[]): Promise<void> {
  const pool = await getPool();
  await pool.query(sql, params);
}

export async function getClient(): Promise<PoolClient> {
  const pool = await getPool();
  return pool.connect();
}

export async function withTransaction<T>(
  fn: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await getClient();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function closePool(): Promise<void> {
  if (_pool) {
    await _pool.end();
    _pool = null;
  }
  _initPromise = null;
}

export async function resetDb(): Promise<void> {
  await closePool();
}

export async function runMigrations(): Promise<void> {
  await getPool();
}
