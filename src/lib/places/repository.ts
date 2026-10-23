import { getPool, query } from "../db/pool";
import type { QueryResultRow } from "pg";

import type { Establishment, EstablishmentSource, SearchQuery, WhatsappConfidence } from "./types";

/**
 * Persistência de estabelecimentos e do cache de buscas.
 *
 * O efeito colateral que interessa: a base própria — o ativo monetizável da
 * fase 3 — se constrói sozinha conforme as pessoas buscam, sem crawler
 * dedicado.
 */

interface EstablishmentRow {
  id: string;
  place_id: string;
  name: string;
  category: string | null;
  address: string | null;
  neighborhood: string | null;
  city: string | null;
  state: string | null;
  lat: number | null;
  lng: number | null;
  phone_e164: string | null;
  whatsapp: WhatsappConfidence;
  rating: number | null;
  reviews_count: number | null;
  source: EstablishmentSource;
  scraped_at: Date;
}

function toEstablishment(row: EstablishmentRow): Establishment {
  return {
    placeId: row.place_id,
    name: row.name,
    category: row.category,
    address: row.address,
    neighborhood: row.neighborhood,
    city: row.city,
    state: row.state,
    lat: row.lat,
    lng: row.lng,
    phoneE164: row.phone_e164,
    whatsapp: row.whatsapp,
    rating: row.rating,
    reviewsCount: row.reviews_count,
    source: row.source,
    scrapedAt: row.scraped_at.toISOString(),
  };
}

/**
 * Chave do cache: minúsculas, sem acento, sem espaço sobrando.
 *
 * É o que faz "Pousada" em "Paraty  RJ" e "pousada" em "paraty rj" caírem na
 * mesma linha — do contrário o cache quase nunca acertaria.
 */
export function normalizeSearchKey(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Chave de região do cache.
 *
 * Busca por ponto não tem nome de região, então a chave é a própria
 * coordenada. Três casas decimais (~110m) é perto o bastante para reaproveitar
 * quando o usuário arrasta o pino um pouco, e longe o bastante para não
 * misturar dois bairros vizinhos na mesma linha.
 */
function regionKey(q: SearchQuery): string {
  if (!q.center) return normalizeSearchKey(q.region);
  return `@${q.center.lat.toFixed(3)},${q.center.lng.toFixed(3)}~${q.center.radiusKm}km`;
}

function cacheTtlDays(): number {
  const raw = Number(process.env.SEARCH_CACHE_TTL_DAYS);
  return Number.isFinite(raw) && raw > 0 ? raw : 7;
}

/**
 * Quem executa a consulta: o pool, ou o client de uma transação em andamento.
 *
 * Existe para que gravar uma cotação (que abre transação) possa gravar os
 * estabelecimentos dentro da mesma transação, em vez de por fora dela.
 */
export interface Queryable {
  query<T extends QueryResultRow>(
    text: string,
    values?: unknown[],
  ): Promise<{ rows: T[] }>;
}

/** Grava ou atualiza estabelecimentos, devolvendo o id interno de cada place_id. */
export async function upsertEstablishments(
  establishments: readonly Establishment[],
  executor: Queryable = getPool(),
): Promise<Map<string, number>> {
  const ids = new Map<string, number>();
  if (establishments.length === 0) return ids;

  for (const e of establishments) {
    const { rows } = await executor.query<{ id: string; place_id: string }>(
      `INSERT INTO establishments (
         place_id, name, category, address, city, state, lat, lng,
         phone_e164, whatsapp, rating, reviews_count, source, scraped_at,
         city_normalized, neighborhood, neighborhood_normalized
       )
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
       ON CONFLICT (place_id) DO UPDATE SET
         name = EXCLUDED.name,
         category = EXCLUDED.category,
         address = EXCLUDED.address,
         city = EXCLUDED.city,
         state = EXCLUDED.state,
         lat = EXCLUDED.lat,
         lng = EXCLUDED.lng,
         phone_e164 = EXCLUDED.phone_e164,
         whatsapp = EXCLUDED.whatsapp,
         rating = EXCLUDED.rating,
         reviews_count = EXCLUDED.reviews_count,
         source = EXCLUDED.source,
         scraped_at = EXCLUDED.scraped_at,
         city_normalized = EXCLUDED.city_normalized,
         neighborhood = EXCLUDED.neighborhood,
         neighborhood_normalized = EXCLUDED.neighborhood_normalized,
         updated_at = now()
       RETURNING id, place_id`,
      [
        e.placeId, e.name, e.category, e.address, e.city, e.state, e.lat, e.lng,
        e.phoneE164, e.whatsapp, e.rating, e.reviewsCount, e.source, e.scrapedAt,
        e.city ? normalizeSearchKey(e.city) : null,
        e.neighborhood,
        e.neighborhood ? normalizeSearchKey(e.neighborhood) : null,
      ],
    );
    ids.set(rows[0].place_id, Number(rows[0].id));
  }

  return ids;
}

export async function findEstablishmentsByPlaceIds(
  placeIds: readonly string[],
): Promise<Establishment[]> {
  if (placeIds.length === 0) return [];

  const rows = await query<EstablishmentRow>(
    "SELECT * FROM establishments WHERE place_id = ANY($1::text[])",
    [placeIds],
  );

  // A ordem do cache é a ordem de relevância que o Google devolveu; o `ANY`
  // não preserva isso, então reordenamos pela lista original.
  const byPlaceId = new Map(rows.map((row) => [row.place_id, toEstablishment(row)]));
  return placeIds.map((id) => byPlaceId.get(id)).filter((e): e is Establishment => Boolean(e));
}

/**
 * Resultado ainda dentro do TTL, ou `null` se não houver, tiver vencido, ou
 * tiver sido coletado com um teto menor do que o pedido agora.
 */
export async function findFreshSearch(
  q: SearchQuery,
  limit: number,
): Promise<{ establishments: Establishment[]; partial: boolean } | null> {
  const rows = await query<{ result_place_ids: string[]; partial: boolean }>(
    `SELECT result_place_ids, partial
       FROM search_cache
      WHERE category_normalized = $1
        AND region_normalized = $2
        AND requested_limit >= $3
        AND expires_at > now()`,
    [normalizeSearchKey(q.category), regionKey(q), limit],
  );

  if (rows.length === 0) return null;

  const establishments = await findEstablishmentsByPlaceIds(rows[0].result_place_ids);
  // Cache apontando para linhas que sumiram é cache inútil: melhor recoletar.
  if (establishments.length === 0) return null;

  return { establishments, partial: rows[0].partial };
}

/** Grava os estabelecimentos e aponta o cache da busca para eles. */
export async function saveSearch(
  q: SearchQuery,
  establishments: readonly Establishment[],
  partial: boolean,
  requestedLimit: number,
): Promise<void> {
  if (establishments.length === 0) return;

  await upsertEstablishments(establishments);

  await query(
    `INSERT INTO search_cache (
       category_normalized, region_normalized, result_place_ids, partial,
       requested_limit, scraped_at, expires_at
     )
     VALUES ($1, $2, $3, $4, $5, now(), now() + ($6 || ' days')::INTERVAL)
     ON CONFLICT (category_normalized, region_normalized) DO UPDATE SET
       result_place_ids = EXCLUDED.result_place_ids,
       partial = EXCLUDED.partial,
       requested_limit = EXCLUDED.requested_limit,
       scraped_at = EXCLUDED.scraped_at,
       expires_at = EXCLUDED.expires_at`,
    [
      normalizeSearchKey(q.category),
      regionKey(q),
      establishments.map((e) => e.placeId),
      partial,
      requestedLimit,
      String(cacheTtlDays()),
    ],
  );
}

/**
 * Regiões que já apareceram em alguma coleta.
 *
 * Bairro vem primeiro que cidade: quem digita "mo" em geral quer "Moema", e
 * bairro é a região mais útil para cotar — a lista de uma cidade inteira é
 * grande demais para uma cotação.
 *
 * Estas sugestões saem da nossa base, então são, por construção, regiões que a
 * busca sabe resolver. As cidades do IBGE entram por cima disso, na rota.
 */
export async function suggestKnownRegions(prefix: string, limit = 6): Promise<string[]> {
  const normalized = normalizeSearchKey(prefix);
  if (normalized.length < 2) return [];

  const rows = await query<{ label: string; kind: string }>(
    `SELECT DISTINCT ON (label) label, kind FROM (
       SELECT neighborhood || ', ' || city || ' ' || state AS label, 'bairro' AS kind
         FROM establishments
        WHERE neighborhood IS NOT NULL AND city IS NOT NULL AND state IS NOT NULL
          AND neighborhood_normalized LIKE $1
       UNION ALL
       SELECT city || ' ' || state AS label, 'cidade' AS kind
         FROM establishments
        WHERE city IS NOT NULL AND state IS NOT NULL
          AND city_normalized LIKE $1
     ) AS regioes
     ORDER BY label, kind
     LIMIT $2`,
    [`${normalized}%`, limit],
  );

  // `kind` ordena bairro antes de cidade dentro do mesmo prefixo.
  return rows
    .sort((a, b) => (a.kind === b.kind ? a.label.localeCompare(b.label, "pt-BR") : a.kind < b.kind ? -1 : 1))
    .map((row) => row.label);
}
