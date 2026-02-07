/* eslint-disable @typescript-eslint/no-explicit-any */
import pg from "pg";
import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";

const { Pool } = pg;

/**
 * Lambda handler that applies Prisma migrations directly via raw SQL.
 * Uses pg Pool instead of Prisma CLI to avoid dependency issues in Lambda.
 */
export async function handler() {
  const pool: any = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  try {
    // Ensure _prisma_migrations table exists
    await pool.query(`
      CREATE TABLE IF NOT EXISTS "_prisma_migrations" (
        "id" VARCHAR(36) NOT NULL PRIMARY KEY,
        "checksum" VARCHAR(64) NOT NULL,
        "finished_at" TIMESTAMPTZ,
        "migration_name" VARCHAR(255) NOT NULL,
        "logs" TEXT,
        "rolled_back_at" TIMESTAMPTZ,
        "started_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "applied_steps_count" INTEGER NOT NULL DEFAULT 0
      )
    `);

    // Get already-applied migrations
    const { rows: applied } = await pool.query(
      `SELECT "migration_name" FROM "_prisma_migrations" WHERE "rolled_back_at" IS NULL ORDER BY "migration_name"`
    );
    const appliedSet = new Set(applied.map((r: { migration_name: string }) => r.migration_name));

    // Read migration directories
    const migrationsDir = path.join(process.cwd(), "prisma", "migrations");
    if (!fs.existsSync(migrationsDir)) {
      return { statusCode: 200, body: "No migrations directory found" };
    }

    const dirs = fs.readdirSync(migrationsDir)
      .filter((d) => {
        const fullPath = path.join(migrationsDir, d, "migration.sql");
        return fs.existsSync(fullPath);
      })
      .sort();

    const results: string[] = [];

    for (const dir of dirs) {
      if (appliedSet.has(dir)) {
        results.push(`SKIP ${dir} (already applied)`);
        continue;
      }

      const sqlPath = path.join(migrationsDir, dir, "migration.sql");
      const sql = fs.readFileSync(sqlPath, "utf-8");
      const checksum = crypto.createHash("sha256").update(sql).digest("hex");
      const id = crypto.randomUUID();

      console.log(`Applying migration: ${dir}`);

      try {
        await pool.query("BEGIN");
        await pool.query(sql);
        await pool.query(
          `INSERT INTO "_prisma_migrations" ("id", "checksum", "migration_name", "finished_at", "applied_steps_count")
           VALUES ($1, $2, $3, now(), 1)`,
          [id, checksum, dir]
        );
        await pool.query("COMMIT");
        results.push(`OK ${dir}`);
        console.log(`Applied migration: ${dir}`);
      } catch (err: unknown) {
        await pool.query("ROLLBACK");
        const msg = err instanceof Error ? err.message : String(err);
        results.push(`FAIL ${dir}: ${msg}`);
        console.error(`Migration ${dir} failed:`, msg);
        // Stop on first failure
        break;
      }
    }

    const output = results.join("\n");
    console.log("Migration results:\n" + output);
    return { statusCode: 200, body: output };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("Migration handler failed:", message);
    return { statusCode: 500, body: message };
  } finally {
    await pool.end();
  }
}
