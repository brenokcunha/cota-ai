import { PlacesBlockedError, PlacesUnavailableError } from "@/lib/places/errors";
import { getPlacesProvider } from "@/lib/places/provider";
import type { SearchCenter, SearchQuery } from "@/lib/places/types";

/**
 * RF-01 — busca de estabelecimentos.
 *
 * `GET /api/search?categoria=pousada&regiao=Paraty%20RJ&limite=10`
 * `GET /api/search?categoria=pousada&lat=-23.21&lng=-44.71&raio=5&limite=10`
 *
 * A região pode vir como texto ou como ponto+raio no mapa. Nos dois casos o
 * resto do fluxo é idêntico — a área só muda como o Google Maps é consultado.
 *
 * Responde de dois jeitos, conforme o `Accept`:
 *
 * - `application/x-ndjson` — um evento por linha, cada ficha chegando assim que
 *   fica pronta. É o que a tela usa: uma busca nova leva dezenas de segundos e
 *   o PRD §6.6 pede progresso, não uma ampulheta.
 * - qualquer outro — um JSON só, no fim. Serve para `curl` e para scripts.
 *
 * A rota é só a porta de entrada: quem sabe buscar é o `PlacesProvider`
 * (PRD §6.2). Trocar scraping por Places API não encosta neste arquivo.
 */

// Playwright precisa do runtime Node, e a coleta é sempre em tempo de request.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_LIMIT = 60;
const MAX_RADIUS_KM = 50;
const DEFAULT_RADIUS_KM = 5;

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const category = params.get("categoria")?.trim();

  if (!category) {
    return problem(400, "Informe `categoria`.");
  }

  const center = parseCenter(params);
  if (center === "invalid") {
    return problem(
      400,
      `\`lat\`/\`lng\` precisam ser coordenadas válidas e \`raio\` um número entre 0,5 e ${MAX_RADIUS_KM} km.`,
    );
  }

  // Sem ponto no mapa, a região em texto é obrigatória: é ela que diz onde
  // procurar. Com ponto, ela é só um rótulo e pode faltar.
  const region = params.get("regiao")?.trim() || (center ? describeCenter(center) : "");
  if (!region) {
    return problem(400, "Informe `regiao`, ou `lat` e `lng`.");
  }

  const limit = parseLimit(params.get("limite"));
  if (limit === "invalid") {
    return problem(400, `\`limite\` deve ser um inteiro entre 1 e ${MAX_LIMIT}.`);
  }

  const query: SearchQuery = {
    category,
    region,
    ...(center ? { center } : {}),
    ...(limit === null ? {} : { limit }),
  };

  const wantsStream = request.headers.get("accept")?.includes("application/x-ndjson");
  return wantsStream ? streamSearch(query, request.signal) : bufferSearch(query, request.signal);
}

/** Um evento por linha, conforme a coleta acontece. */
function streamSearch(query: SearchQuery, signal: AbortSignal): Response {
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let closed = false;
      const send = (event: object) => {
        if (closed) return;
        controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
      };

      // Sai já, antes de qualquer trabalho: é o que faz a tela sair do estado
      // "conectando" mesmo que o Google demore para responder.
      send({ type: "start", query });

      try {
        const provider = await getPlacesProvider();
        const result = await provider.search(query, {
          onProgress: (progress) => send({ type: "progress", ...progress }),
          onEstablishment: (establishment, index) => send({ type: "establishment", index, establishment }),
          signal,
        });

        send({
          type: "done",
          total: result.establishments.length,
          fromCache: result.fromCache,
          partial: result.partial,
        });
      } catch (error) {
        // O 200 já foi enviado com o primeiro evento, então erro aqui não pode
        // mais virar status HTTP — vira um evento que a tela sabe exibir.
        const { status, message } = describe(error);
        send({ type: "error", status, message });
      } finally {
        closed = true;
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "application/x-ndjson; charset=utf-8",
      "cache-control": "no-store",
      // Impede proxies de segurar os pedaços até o fim, que anularia o streaming.
      "x-accel-buffering": "no",
    },
  });
}

/** Resposta única no fim, para `curl` e scripts. */
async function bufferSearch(query: SearchQuery, signal: AbortSignal): Promise<Response> {
  try {
    const provider = await getPlacesProvider();
    return Response.json(await provider.search(query, { signal }));
  } catch (error) {
    const { status, message } = describe(error);
    if (status === 500) console.error("[api/search] falha inesperada", error);
    return problem(status, message);
  }
}

function describe(error: unknown): { status: number; message: string } {
  // 429 e não 500: o pedido estava certo, a fonte é que recusou.
  if (error instanceof PlacesBlockedError) return { status: 429, message: error.message };
  if (error instanceof PlacesUnavailableError) return { status: 502, message: error.message };
  return { status: 500, message: "Não foi possível concluir a busca." };
}

/** `null` quando a busca não é por mapa; `"invalid"` quando é, mas veio torta. */
function parseCenter(params: URLSearchParams): SearchCenter | null | "invalid" {
  const rawLat = params.get("lat");
  const rawLng = params.get("lng");
  if (!rawLat && !rawLng) return null;

  const lat = Number(rawLat);
  const lng = Number(rawLng);
  if (!Number.isFinite(lat) || lat < -90 || lat > 90) return "invalid";
  if (!Number.isFinite(lng) || lng < -180 || lng > 180) return "invalid";

  const rawRadius = params.get("raio");
  const radiusKm = rawRadius === null || rawRadius === "" ? DEFAULT_RADIUS_KM : Number(rawRadius);
  if (!Number.isFinite(radiusKm) || radiusKm < 0.5 || radiusKm > MAX_RADIUS_KM) return "invalid";

  return { lat, lng, radiusKm };
}

/** Rótulo legível para uma busca sem nome de região. */
function describeCenter(center: SearchCenter): string {
  const number = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 4 });
  return `${number.format(center.radiusKm)} km ao redor de ${number.format(center.lat)}, ${number.format(center.lng)}`;
}

function parseLimit(raw: string | null): number | null | "invalid" {
  if (raw === null || raw === "") return null;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 1 || value > MAX_LIMIT) return "invalid";
  return value;
}

function problem(status: number, message: string) {
  return Response.json({ error: message }, { status });
}
