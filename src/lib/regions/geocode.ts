import { hasDatabase, query } from "../db/pool";
import { normalizeSearchKey } from "../places/repository";

/**
 * Nome de região → coordenada, para o mapa acompanhar o que a pessoa digitou.
 *
 * Usa o Nominatim (o geocodificador do OpenStreetMap), coerente com os tiles
 * que o mapa já carrega. Duas restrições da política de uso deles moldaram
 * este arquivo:
 *
 * - **Máximo 1 requisição por segundo.** Daí a fila com espaçamento mínimo.
 * - **Proibido usar em autocomplete.** Por isso a tela só geocodifica a região
 *   escolhida, depois que a digitação para — nunca a cada tecla.
 *
 * E daí o cache permanente no Postgres: a coordenada de Caraíva não muda, e
 * assim o serviço externo é chamado uma vez por região distinta, para sempre.
 *
 * Volume de produto pede um provedor próprio: `NOMINATIM_URL` aponta para uma
 * instância self-hosted ou comercial sem tocar em mais nada.
 */

export interface GeocodeResult {
  lat: number;
  lng: number;
  /** Nome completo como a fonte entende o lugar, para o usuário conferir. */
  label: string;
}

const NOMINATIM_URL = process.env.NOMINATIM_URL || "https://nominatim.openstreetmap.org/search";

/**
 * A política do Nominatim exige um User-Agent que identifique a aplicação;
 * requisição anônima é bloqueada.
 */
const USER_AGENT = process.env.NOMINATIM_USER_AGENT || "cota-ai/0.1 (cotacao por WhatsApp)";

/** Espaçamento mínimo entre chamadas externas, em ms. */
const MIN_INTERVAL_MS = 1_100;

let lastCall = 0;
/** Fila de um só: encadeia as chamadas para nunca haver duas simultâneas. */
let queue: Promise<unknown> = Promise.resolve();

function schedule<T>(task: () => Promise<T>): Promise<T> {
  const run = queue.then(async () => {
    const wait = MIN_INTERVAL_MS - (Date.now() - lastCall);
    if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
    lastCall = Date.now();
    return task();
  });

  // A fila não pode parar por causa de uma falha; quem chamou é que recebe o erro.
  queue = run.catch(() => {});
  return run;
}

export async function geocodeRegion(region: string): Promise<GeocodeResult | null> {
  const key = normalizeSearchKey(region);
  if (key.length < 2) return null;

  const cached = await readCache(key);
  if (cached !== undefined) return cached;

  const found = await schedule(() => callNominatim(region));
  await writeCache(key, found);
  return found;
}

async function callNominatim(region: string): Promise<GeocodeResult | null> {
  const url = new URL(NOMINATIM_URL);
  url.searchParams.set("q", region);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("limit", "1");
  // O produto é Brasil-only no MVP; restringir melhora muito a precisão de
  // nomes ambíguos ("Trancoso" existe em Portugal).
  url.searchParams.set("countrycodes", "br");

  const response = await fetch(url, {
    headers: { "user-agent": USER_AGENT, "accept-language": "pt-BR" },
    signal: AbortSignal.timeout(8_000),
  });

  if (!response.ok) {
    throw new Error(`Nominatim respondeu ${response.status}.`);
  }

  const body = (await response.json()) as Array<{
    lat?: string;
    lon?: string;
    display_name?: string;
  }>;

  const first = body[0];
  if (!first?.lat || !first?.lon) return null;

  const lat = Number(first.lat);
  const lng = Number(first.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

  return { lat, lng, label: first.display_name ?? region };
}

/** `undefined` = nunca consultado; `null` = consultado e não encontrado. */
async function readCache(key: string): Promise<GeocodeResult | null | undefined> {
  if (!hasDatabase()) return undefined;

  try {
    const rows = await query<{ found: boolean; lat: number | null; lng: number | null; label: string | null }>(
      "SELECT found, lat, lng, label FROM geocode_cache WHERE query_normalized = $1",
      [key],
    );

    if (rows.length === 0) return undefined;
    const row = rows[0];
    if (!row.found || row.lat === null || row.lng === null) return null;
    return { lat: row.lat, lng: row.lng, label: row.label ?? "" };
  } catch (error) {
    // Cache indisponível degrada para consulta externa, não para erro.
    console.error("[geocode] leitura do cache falhou", error);
    return undefined;
  }
}

async function writeCache(key: string, result: GeocodeResult | null): Promise<void> {
  if (!hasDatabase()) return;

  try {
    await query(
      `INSERT INTO geocode_cache (query_normalized, found, lat, lng, label)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (query_normalized) DO UPDATE SET
         found = EXCLUDED.found,
         lat = EXCLUDED.lat,
         lng = EXCLUDED.lng,
         label = EXCLUDED.label`,
      [key, result !== null, result?.lat ?? null, result?.lng ?? null, result?.label ?? null],
    );
  } catch (error) {
    console.error("[geocode] gravação do cache falhou", error);
  }
}
