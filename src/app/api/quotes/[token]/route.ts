import { hasDatabase } from "@/lib/db/pool";
import { findQuote } from "@/lib/quote/repository";

/** RF-08 — devolve a cotação de um link de retomada. */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: RouteContext<"/api/quotes/[token]">) {
  if (!hasDatabase()) {
    return Response.json({ error: "Servidor sem banco configurado." }, { status: 503 });
  }

  const { token } = await context.params;

  try {
    const quote = await findQuote(token);
    if (!quote) {
      return Response.json({ error: "Cotação não encontrada." }, { status: 404 });
    }
    return Response.json(quote);
  } catch (error) {
    console.error("[api/quotes] falha ao ler", error);
    return Response.json({ error: "Não foi possível abrir a cotação." }, { status: 500 });
  }
}
