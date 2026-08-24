import { Pool } from "pg";

/**
 * Pool de conexões Postgres, único por processo.
 *
 * Em desenvolvimento o Next recarrega os módulos a cada mudança; sem guardar o
 * pool no escopo global, cada reload abriria um pool novo e o Postgres acabaria
 * recusando conexão por esgotar `max_connections`.
 */

declare global {
  // `var` e nao `let`: e a unica forma de declarar propriedade de globalThis.
  var __cotaAiPool: Pool | undefined;
}

/** `true` quando há banco configurado. Sem ele o app roda, só que sem cache. */
export function hasDatabase(): boolean {
  return Boolean(process.env.DATABASE_URL);
}

export function getPool(): Pool {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL não configurada.");
  }

  globalThis.__cotaAiPool ??= new Pool({
    connectionString: process.env.DATABASE_URL,
    max: Number(process.env.DATABASE_POOL_MAX ?? 10),
    // Uma busca nova segura a conexão enquanto grava dezenas de fichas.
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
  });

  return globalThis.__cotaAiPool;
}

/** Atalho para consultas de uma linha só, que são a maioria aqui. */
export async function query<T extends object>(
  text: string,
  values: readonly unknown[] = [],
): Promise<T[]> {
  const result = await getPool().query<T>(text, values as unknown[]);
  return result.rows;
}
