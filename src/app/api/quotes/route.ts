import { hasDatabase } from "@/lib/db/pool";
import { saveQuote } from "@/lib/quote/repository";
import { rateLimit, tooManyRequests } from "@/lib/rate-limit";
import { QuoteValidationError, parseQuoteInput } from "@/lib/quote/validate";

/**
 * Grava a cotação e devolve o token do link de retomada.
 *
 * `POST /api/quotes` cria; mandar `shareToken` no corpo atualiza a existente,
 * que é como o progresso do disparo acompanha o link.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * 200 alvos de ~1 KB cada cabem folgados; acima disto é abuso. Sem teto,
 * `request.json()` lê o corpo inteiro na memória, seja qual for o tamanho.
 */
const MAX_BODY_BYTES = 512 * 1024;

export async function POST(request: Request) {
  const wait = rateLimit(request, "quotes", { limit: 30, windowMs: 60_000 });
  if (wait !== null) return tooManyRequests(wait);

  if (!hasDatabase()) {
    return Response.json(
      { error: "Link de retomada indisponível: o servidor está sem banco configurado." },
      { status: 503 },
    );
  }

  const declared = Number(request.headers.get("content-length"));
  if (declared > MAX_BODY_BYTES) return bodyTooLarge();

  // O cabeçalho pode mentir ou faltar (chunked): a contagem que vale é a do corpo lido.
  const body = await request.text();
  if (body.length > MAX_BODY_BYTES) return bodyTooLarge();

  let input;
  try {
    input = parseQuoteInput(JSON.parse(body));
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

function bodyTooLarge() {
  return Response.json({ error: "Cotação grande demais." }, { status: 413 });
}
