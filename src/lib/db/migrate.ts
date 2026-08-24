import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";

import { getPool } from "./pool";

/**
 * Aplica as migrations de `db/migrations` que ainda não rodaram.
 *
 * Rodar na subida do servidor mantém o ciclo local em um comando só
 * (`docker compose up`). Quando houver deploy de verdade isso vira um passo
 * separado do pipeline — subir o app não é hora de descobrir que o schema não
 * aplica.
 */

const MIGRATIONS_DIR = join(process.cwd(), "db", "migrations");

/** Trava do Postgres para dois containers subindo juntos não aplicarem duas vezes. */
const LOCK_KEY = 4_820_113;

export async function migrate(): Promise<void> {
  const pool = getPool();
  const client = await pool.connect();

  try {
    await client.query("SELECT pg_advisory_lock($1)", [LOCK_KEY]);
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version    TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);

    const applied = new Set(
      (await client.query<{ version: string }>("SELECT version FROM schema_migrations")).rows.map(
        (row) => row.version,
      ),
    );

    const files = (await readdir(MIGRATIONS_DIR)).filter((f) => f.endsWith(".sql")).sort();

    for (const file of files) {
      if (applied.has(file)) continue;

      const sql = await readFile(join(MIGRATIONS_DIR, file), "utf8");

      // Cada migration é atômica: ou aplica inteira, ou não conta como aplicada.
      await client.query("BEGIN");
      try {
        await client.query(sql);
        await client.query("INSERT INTO schema_migrations (version) VALUES ($1)", [file]);
        await client.query("COMMIT");
        console.log(`[db] migration aplicada: ${file}`);
      } catch (error) {
        await client.query("ROLLBACK");
        throw new Error(`Migration ${file} falhou.`, { cause: error });
      }
    }
  } finally {
    await client.query("SELECT pg_advisory_unlock($1)", [LOCK_KEY]).catch(() => {});
    client.release();
  }
}
