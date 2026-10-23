import type { PlacesProvider, SearchOptions } from "./provider";
import { findFreshSearch, saveSearch } from "./repository";
import type { SearchQuery, SearchResult } from "./types";

/**
 * Cache híbrido, como um envelope em volta da fonte real.
 *
 * Busca repetida dentro do TTL sai do Postgres, instantânea. Busca nova vai ao
 * scraper e o resultado fica gravado — é assim que a base própria, o ativo da
 * fase 3, se constrói sozinha conforme as pessoas usam.
 */
export class CachedPlacesProvider implements PlacesProvider {
  readonly name: string;

  constructor(private readonly source: PlacesProvider) {
    this.name = `cached(${source.name})`;
  }

  async search(query: SearchQuery, options?: SearchOptions): Promise<SearchResult> {
    const limit = query.limit ?? 0;

    const cached = await findFreshSearch(query, limit).catch((error) => {
      // Banco fora do ar degrada para busca ao vivo, não para erro na tela.
      console.error("[cache] leitura falhou, seguindo para a fonte", error);
      return null;
    });

    if (cached) {
      const establishments = limit > 0 ? cached.establishments.slice(0, limit) : cached.establishments;
      options?.onProgress?.({ phase: "collecting", total: establishments.length });
      establishments.forEach((e, index) => options?.onEstablishment?.(e, index));
      return { query, establishments, fromCache: true, partial: cached.partial };
    }

    const result = await this.source.search(query, options);

    try {
      await saveSearch(query, result.establishments, result.partial, limit);
    } catch (error) {
      // A busca já foi entregue ao usuário; falhar em gravá-la não a invalida.
      console.error("[cache] gravação falhou", error);
    }

    return result;
  }
}
