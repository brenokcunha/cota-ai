/**
 * Tipos de domínio da busca de estabelecimentos.
 *
 * Estes tipos são a fronteira estável do sistema: qualquer fonte de dados
 * (scraper, Places API, base própria) precisa produzir `Establishment`.
 */

/** Origem do dado, para auditoria e para decidir política de cache. */
export type EstablishmentSource = "google-maps-scraper" | "google-places-api" | "own-database";

/**
 * Confiança de que o telefone atende no WhatsApp.
 *
 * No MVP isso é heurístico (celular vs fixo pelo formato do número), então o
 * produto nunca promete — no máximo indica.
 */
export type WhatsappConfidence = "likely" | "unlikely" | "unknown";

export interface Establishment {
  /** Identificador estável do Google Maps, quando disponível. */
  placeId: string;
  name: string;
  /** Categoria como reportada pela fonte (ex: "Pousada", "Floricultura"). */
  category: string | null;
  address: string | null;
  /** Bairro, quando o endereço traz. Alimenta o autocomplete da busca. */
  neighborhood: string | null;
  city: string | null;
  state: string | null;
  lat: number | null;
  lng: number | null;
  /** Telefone normalizado em E.164 (ex: "+5521999998888"), ou null se ausente. */
  phoneE164: string | null;
  whatsapp: WhatsappConfidence;
  rating: number | null;
  reviewsCount: number | null;
  source: EstablishmentSource;
  scrapedAt: string;
}

/**
 * Ponto no mapa e raio, quando o usuário desenha a área em vez de digitá-la.
 *
 * Não substitui a busca por texto: é outro jeito de dizer "onde", para quando
 * a região que interessa não tem nome (a orla, o trecho entre duas cidades).
 */
export interface SearchCenter {
  lat: number;
  lng: number;
  radiusKm: number;
}

export interface SearchQuery {
  /** O que buscar, em texto livre: "pousada", "floricultura". */
  category: string;
  /**
   * Onde buscar: "Paraty RJ", "Moema, São Paulo".
   *
   * Com `center` preenchido, isto vira só o rótulo que aparece na tela — quem
   * manda na coleta é o ponto.
   */
  region: string;
  /** Área desenhada no mapa. Ausente numa busca por texto. */
  center?: SearchCenter;
  /** Teto de resultados. O provider pode devolver menos. */
  limit?: number;
}

export interface SearchResult {
  query: SearchQuery;
  establishments: Establishment[];
  /**
   * true quando o resultado veio do cache em vez de uma coleta nova.
   * A UI usa isso para explicar por que a busca foi instantânea.
   */
  fromCache: boolean;
  /**
   * Resultado parcial: a coleta falhou no meio mas devolvemos o que deu.
   * Nunca devolver tela branca.
   */
  partial: boolean;
}
