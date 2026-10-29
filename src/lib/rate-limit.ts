/**
 * Limite de requisições por janela fixa, em memória.
 *
 * Existe por causa da busca: cada `/api/search` sobe um Chromium inteiro, e
 * quem alcança a porta (outro aparelho da rede local, um script em loop)
 * esgota memória e CPU da máquina — e queima o IP no Google. Em memória
 * basta: o app é um processo só, e reiniciar zera a contagem.
 */

interface Window {
  count: number;
  resetAt: number;
}

declare global {
  // `var` e nao `let`: e a unica forma de declarar propriedade de globalThis.
  var __cotaAiRateLimits: Map<string, Window> | undefined;
}

/** Janelas vencidas são varridas quando o mapa passa disto, para não crescer sem fim. */
const SWEEP_AT = 1_000;

/**
 * Quem está chamando. Atrás do Docker o IP de origem costuma ser o do gateway,
 * então na prática isto vira um limite global — que é o que se quer aqui.
 */
export function clientKey(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || "local";
}

/**
 * `null` se a chamada passa; senão, quantos segundos esperar.
 *
 * `bucket` separa as rotas: gastar a cota da busca não pode travar o link de
 * retomada.
 */
export function rateLimit(
  request: Request,
  bucket: string,
  { limit, windowMs }: { limit: number; windowMs: number },
): number | null {
  const windows = (globalThis.__cotaAiRateLimits ??= new Map());
  const now = Date.now();

  if (windows.size > SWEEP_AT) {
    for (const [key, window] of windows) {
      if (window.resetAt <= now) windows.delete(key);
    }
  }

  const key = `${bucket}:${clientKey(request)}`;
  const current = windows.get(key);

  if (!current || current.resetAt <= now) {
    windows.set(key, { count: 1, resetAt: now + windowMs });
    return null;
  }

  current.count += 1;
  if (current.count <= limit) return null;

  return Math.ceil((current.resetAt - now) / 1_000);
}

/** Resposta 429 padrão, com `Retry-After`. */
export function tooManyRequests(retryAfterSeconds: number): Response {
  return Response.json(
    { error: `Muitas requisições. Tente de novo em ${retryAfterSeconds}s.` },
    { status: 429, headers: { "retry-after": String(retryAfterSeconds) } },
  );
}
