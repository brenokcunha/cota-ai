/**
 * Roda uma vez na subida do servidor.
 *
 * Não aplica migrations: quem faz isso é `scripts/migrate.mjs`, antes do
 * servidor existir. Aqui só avisa quando o app vai subir sem banco, para que a
 * causa apareça no log em vez de virar um erro estranho na primeira busca.
 */
export async function register() {
  // O arquivo também é avaliado no runtime edge, onde `pg` não existe.
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  if (!process.env.DATABASE_URL) {
    console.warn("[db] DATABASE_URL ausente — sem cache e sem link de retomada.");
  }
}
