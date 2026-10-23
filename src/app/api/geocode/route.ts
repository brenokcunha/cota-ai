import { geocodeRegion } from "@/lib/regions/geocode";

/**
 * Onde fica a região que a pessoa digitou.
 *
 * `GET /api/geocode?q=Caraíva, Porto Seguro BA` -> `{"lat":…, "lng":…, "label":…}`
 *
 * Serve só para o mapa se posicionar. Não define a área da busca: quem faz
 * isso é o clique no mapa, que é uma escolha explícita do usuário.
 *
 * `null` é resposta legítima — nem toda região tem coordenada conhecida, e o
 * campo de texto continua funcionando do mesmo jeito.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const q = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) return Response.json({ result: null });

  try {
    return Response.json({ result: await geocodeRegion(q) });
  } catch (error) {
    // O mapa não se mover é um incômodo; a busca continua inteira.
    console.error("[api/geocode] falha ao localizar", error);
    return Response.json({ result: null });
  }
}
