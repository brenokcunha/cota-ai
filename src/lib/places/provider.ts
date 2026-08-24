import type { SearchQuery, SearchResult } from "./types";

/**
 * Fonte de estabelecimentos.
 *
 * O MVP usa scraping do Google Maps, que é o risco #1 do projeto (PRD §8).
 * Toda a aplicação fala com esta interface e nunca com o scraper direto, para
 * que trocar de fonte custe uma variável de ambiente e não uma refatoração.
 */
export interface PlacesProvider {
  readonly name: string;
  search(query: SearchQuery): Promise<SearchResult>;
}

export type PlacesProviderId = "scraper" | "places-api" | "own-db";

/**
 * Resolve o provider ativo a partir de PLACES_PROVIDER.
 *
 * Import dinâmico de propósito: o scraper carrega Playwright, que não deve
 * entrar no bundle das rotas que servem do cache.
 */
export async function getPlacesProvider(): Promise<PlacesProvider> {
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
