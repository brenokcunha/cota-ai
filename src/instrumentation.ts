/**
 * Roda uma vez na subida do servidor.
 *
 * Sem `DATABASE_URL` o app continua funcionando: a busca sai direto do scraper,
 * sem cache e sem link de retomada. É o que permite rodar `npm run dev` no host
 * sem subir o Postgres.
 */
export async function register() {
  // O arquivo também é avaliado no runtime edge, onde `pg` não existe.
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const { hasDatabase } = await import("./lib/db/pool");
  if (!hasDatabase()) {
    console.warn("[db] DATABASE_URL ausente — rodando sem cache e sem link de retomada.");
    return;
  }

  const { migrate } = await import("./lib/db/migrate");
  try {
    await migrate();
  } catch (error) {
    // Derrubar o servidor aqui esconderia o motivo atrás de um restart em loop.
    console.error("[db] falha ao aplicar migrations", error);
  }
}
