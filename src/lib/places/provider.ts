import type { Establishment, SearchQuery, SearchResult } from "./types";

/**
 * Fonte de estabelecimentos.
 *
 * O MVP usa scraping do Google Maps, que é o risco #1 do projeto (PRD §8).
 * Toda a aplicação fala com esta interface e nunca com o scraper direto, para
 * que trocar de fonte custe uma variável de ambiente e não uma refatoração.
 */
export interface PlacesProvider {
  readonly name: string;
  search(query: SearchQuery, options?: SearchOptions): Promise<SearchResult>;
}

/**
 * Em que pé está a coleta.
 *
 * Existe porque os primeiros segundos de uma busca nova não produzem nenhum
 * resultado — sobe browser, abre o Google, rola o feed — e sem isso a tela
 * fica muda e parece travada.
 */
export interface SearchProgress {
  phase: "starting" | "listing" | "collecting";
  /** Quantas fichas serão lidas. Só existe a partir de `collecting`. */
  total?: number;
}

export interface SearchOptions {
  /** Chamado a cada mudança de fase da coleta. */
  onProgress?(progress: SearchProgress): void;

  /**
   * Chamado assim que cada ficha fica pronta.
   *
   * É o que permite a tela mostrar resultado enquanto a coleta continua: uma
   * busca nova leva dezenas de segundos, e o PRD §6.6 pede feedback de
   * progresso em vez de uma espera cega.
   */
  onEstablishment?(establishment: Establishment, index: number): void;
  /** Aborta a coleta quando o cliente desiste (fecha a aba, cancela a busca). */
  signal?: AbortSignal;
}

export type PlacesProviderId = "scraper" | "places-api" | "own-db";

/**
 * Resolve o provider ativo a partir de PLACES_PROVIDER, com o cache por cima
 * quando há banco configurado (PRD §6.3).
 *
 * Imports dinâmicos de propósito: o scraper carrega Playwright e o cache
 * carrega `pg`, e nenhum dos dois deve entrar no bundle de quem não usa.
 */
export async function getPlacesProvider(): Promise<PlacesProvider> {
  const source = await getSourceProvider();

  const { hasDatabase } = await import("../db/pool");
  if (!hasDatabase()) return source;

  const { CachedPlacesProvider } = await import("./cached-provider");
  return new CachedPlacesProvider(source);
}

async function getSourceProvider(): Promise<PlacesProvider> {
  const id = (process.env.PLACES_PROVIDER ?? "scraper") as PlacesProviderId;

  switch (id) {
    case "scraper": {
      const { GoogleMapsScraperProvider } = await import("./google-maps-scraper");
      return new GoogleMapsScraperProvider();
    }
    case "places-api":
    case "own-db":
      throw new Error(`Provider "${id}" ainda não implementado (PRD §6.2, fases 2-3).`);
    default:
      throw new Error(`PLACES_PROVIDER desconhecido: "${id}".`);
  }
}
