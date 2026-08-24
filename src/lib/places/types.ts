/**
 * Tipos de domínio da busca de estabelecimentos.
 *
 * Estes tipos são a fronteira estável do sistema: qualquer fonte de dados
 * (scraper, Places API, base própria) precisa produzir `Establishment`.
 * Ver PRD §6.2.
 */

/** Origem do dado, para auditoria e para decidir política de cache. */
export type EstablishmentSource = "google-maps-scraper" | "google-places-api" | "own-database";

/**
 * Confiança de que o telefone atende no WhatsApp.
 *
 * No MVP isso é heurístico (celular vs fixo pelo formato do número), então o
 * produto nunca promete — no máximo indica. Ver PRD §8, risco 3.
 */
export type WhatsappConfidence = "likely" | "unlikely" | "unknown";

export interface Establishment {
  /** Identificador estável do Google Maps, quando disponível. */
  placeId: string;
  name: string;
  /** Categoria como reportada pela fonte (ex: "Pousada", "Floricultura"). */
  category: string | null;
  address: string | null;
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

export interface SearchQuery {
  /** O que buscar, em texto livre: "pousada", "floricultura". */
  category: string;
  /** Onde buscar: "Paraty RJ", "Moema, São Paulo". */
  region: string;
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
   * Nunca devolver tela branca. Ver PRD §6.6.
   */
  partial: boolean;
}
