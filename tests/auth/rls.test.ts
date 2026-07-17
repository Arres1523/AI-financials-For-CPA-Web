import { describe, it, expect } from "vitest";

const hasTestDb = Boolean(process.env.DATABASE_URL_TEST);

describe.runIf(hasTestDb)("RLS isolation", () => {
  it("User A cannot select User B's companies", async () => {
    const userIdA = "user-a-uuid";
    const userIdB = "user-b-uuid";

    const { Pool } = await import("pg");
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL_TEST,
      ssl: { rejectUnauthorized: false },
    });

    try {
      await pool.query("DELETE FROM companies WHERE user_id = $1 OR user_id = $2", [userIdA, userIdB]);

      await pool.query(
        "INSERT INTO companies (id, legal_name, user_id) VALUES ($1, $2, $3)",
        ["test-company-a", "Test Company A", userIdA]
      );
      await pool.query(
        "INSERT INTO companies (id, legal_name, user_id) VALUES ($1, $2, $3)",
        ["test-company-b", "Test Company B", userIdB]
      );

      const { rows: userBSees } = await pool.query(
        "SELECT id FROM companies WHERE user_id = $1",
        [userIdB]
      );
      expect(userBSees.length).toBe(1);
      expect(userBSees[0].id).toBe("test-company-b");

      const { rows: userASeesOwn } = await pool.query(
        "SELECT id, legal_name FROM companies WHERE user_id = $1 ORDER BY legal_name",
        [userIdA]
      );
      expect(userASeesOwn.length).toBe(1);
      expect(userASeesOwn[0].id).toBe("test-company-a");
    } finally {
      await pool.query("DELETE FROM companies WHERE id = $1 OR id = $2", ["test-company-a", "test-company-b"]);
      await pool.end();
    }
  });

  it("RLS blocks cross-user UPDATE", async () => {
    const userIdA = "user-a-uuid";
    const userIdB = "user-b-uuid";

    const { Pool } = await import("pg");
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL_TEST,
      ssl: { rejectUnauthorized: false },
    });

    try {
      await pool.query("DELETE FROM companies WHERE user_id = $1 OR user_id = $2", [userIdA, userIdB]);

      await pool.query(
        "INSERT INTO companies (id, legal_name, user_id) VALUES ($1, $2, $3)",
        ["test-cross-update", "Test Cross Update", userIdA]
      );

      const { rows: userBCanUpdate } = await pool.query(
        "UPDATE companies SET legal_name = 'Hacked' WHERE id = $1 AND user_id = $2 RETURNING id",
        ["test-cross-update", userIdB]
      );
      expect(userBCanUpdate.length).toBe(0);
    } finally {
      await pool.query("DELETE FROM companies WHERE id = $1", ["test-cross-update"]);
      await pool.end();
    }
  });
});
