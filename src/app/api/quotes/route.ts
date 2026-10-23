import { hasDatabase } from "@/lib/db/pool";
import { saveQuote } from "@/lib/quote/repository";
import { QuoteValidationError, parseQuoteInput } from "@/lib/quote/validate";

/**
 * Grava a cotação e devolve o token do link de retomada.
 *
 * `POST /api/quotes` cria; mandar `shareToken` no corpo atualiza a existente,
 * que é como o progresso do disparo acompanha o link.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!hasDatabase()) {
    return Response.json(
      { error: "Link de retomada indisponível: o servidor está sem banco configurado." },
      { status: 503 },
    );
  }

  let input;
  try {
    input = parseQuoteInput(await request.json());
  } catch (error) {
    if (error instanceof QuoteValidationError) {
      return Response.json({ error: error.message }, { status: 400 });
    }
    return Response.json({ error: "Corpo da requisição não é JSON válido." }, { status: 400 });
  }

  try {
    return Response.json({ shareToken: await saveQuote(input) }, { status: 201 });
  } catch (error) {
    console.error("[api/quotes] falha ao gravar", error);
    return Response.json({ error: "Não foi possível salvar a cotação." }, { status: 500 });
  }
}
