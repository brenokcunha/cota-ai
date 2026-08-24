/**
 * Aplica as migrations de `db/migrations` que ainda não rodaram.
 *
 *   node scripts/migrate.mjs
 *
 * É o único lugar que aplica schema. Roda antes do servidor subir: local, pelo
 * entrypoint do container; em produção, pelo `release_command` do Fly, que
 * executa antes da nova versão receber tráfego.
 *
 * Rodar isso de dentro do servidor web parecia prático e não é: num deploy com
 * mais de uma instância, a que subir primeiro aplicaria o schema enquanto as
 * outras ainda servem o código antigo.
 */

import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import pg from "pg";

const MIGRATIONS_DIR = join(process.cwd(), "db", "migrations");

/** Trava do Postgres para dois deploys simultâneos não aplicarem duas vezes. */
const LOCK_KEY = 4_820_113;

if (!process.env.DATABASE_URL) {
  console.error("[db] DATABASE_URL não configurada.");
  process.exit(1);
}

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();

try {
  await client.query("SELECT pg_advisory_lock($1)", [LOCK_KEY]);
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version    TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  const { rows } = await client.query("SELECT version FROM schema_migrations");
  const aplicadas = new Set(rows.map((row) => row.version));

  const arquivos = (await readdir(MIGRATIONS_DIR)).filter((f) => f.endsWith(".sql")).sort();
  const pendentes = arquivos.filter((f) => !aplicadas.has(f));

  if (pendentes.length === 0) {
    console.log(`[db] schema em dia (${arquivos.length} migrations).`);
  }

  for (const arquivo of pendentes) {
    const sql = await readFile(join(MIGRATIONS_DIR, arquivo), "utf8");

    // Cada migration é atômica: ou aplica inteira, ou não conta como aplicada.
    await client.query("BEGIN");
    try {
      await client.query(sql);
      await client.query("INSERT INTO schema_migrations (version) VALUES ($1)", [arquivo]);
      await client.query("COMMIT");
      console.log(`[db] aplicada: ${arquivo}`);
    } catch (error) {
      await client.query("ROLLBACK");
      throw new Error(`Migration ${arquivo} falhou.`, { cause: error });
    }
  }
} finally {
  await client.query("SELECT pg_advisory_unlock($1)", [LOCK_KEY]).catch(() => {});
  await client.end();
}
