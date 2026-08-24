import type { PlacesProvider } from "./provider";
import type { SearchQuery, SearchResult } from "./types";

/**
 * Coleta listagens públicas do Google Maps via browser headless.
 *
 * Implementação pendente (RF-01). Roda no worker separado, não em serverless:
 * o tempo de vida de um browser headless não cabe no timeout da Vercel
 * (PRD §6.4).
 */
export class GoogleMapsScraperProvider implements PlacesProvider {
  readonly name = "google-maps-scraper";

  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- assinatura fixada pela interface; stub até RF-01
  async search(_query: SearchQuery): Promise<SearchResult> {
    throw new Error("GoogleMapsScraperProvider.search ainda não implementado (RF-01).");
  }
}
