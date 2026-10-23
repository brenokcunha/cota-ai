import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { Locator, Page } from "playwright";

import { distanceKm } from "../geo";
import { guessWhatsapp, toE164 } from "../phone";
import { PlacesBlockedError, PlacesUnavailableError } from "./errors";
import type { PlacesProvider, SearchOptions } from "./provider";
import { getScraperConfig, type ScraperConfig } from "./scraper/config";
import { openSession, sleep } from "./scraper/browser";
import {
  parseCityState,
  parseLatLng,
  parseNameFromUrl,
  parsePhoneFromItemId,
  parsePlaceId,
  parseRating,
  parseReviewsCount,
  stripLabelPrefix,
} from "./scraper/parse";
import { BLOCK_PHRASES, SELECTORS, buildSearchUrl } from "./scraper/selectors";
import type { Establishment, SearchQuery, SearchResult } from "./types";

/**
 * Coleta listagens públicas do Google Maps via browser headless.
 *
 * O fluxo é: abrir a busca, rolar o feed até juntar links suficientes, e então
 * visitar cada ficha para pegar o telefone — que é o dado que o produto existe
 * para entregar e o único que o feed não mostra.
 *
 * Roda em processo Node de vida longa (container/worker), não em serverless:
 * um browser headless não cabe no timeout da Vercel.
 */
export class GoogleMapsScraperProvider implements PlacesProvider {
  readonly name = "google-maps-scraper";

  constructor(private readonly config: ScraperConfig = getScraperConfig()) {}

  async search(query: SearchQuery, options?: SearchOptions): Promise<SearchResult> {
    const limit = Math.min(query.limit ?? this.config.maxResults, this.config.maxResults);

    options?.onProgress?.({ phase: "starting" });
    const session = await openSession(this.config);

    try {
      const page = await session.context.newPage();

      options?.onProgress?.({ phase: "listing" });
      const urls = await this.collectPlaceUrls(page, query, limit);

      if (urls.length === 0) {
        return { query, establishments: [], fromCache: false, partial: false };
      }

      // A partir daqui a tela sabe quantas fichas faltam e pode mostrar barra
      // determinada em vez de animação sem fim.
      options?.onProgress?.({ phase: "collecting", total: urls.length });

      const establishments: Establishment[] = [];
      let partial = false;

      for (const [index, url] of urls.entries()) {
        // Desistiu no meio? Devolvemos o que já temos em vez de seguir
        // gastando request no Google para ninguém.
        if (options?.signal?.aborted) {
          partial = true;
          break;
        }

        try {
          const establishment = await this.scrapePlace(page, url);
          establishments.push(establishment);
          options?.onEstablishment?.(establishment, establishments.length - 1);
        } catch (error) {
          // Uma ficha que falha não derruba a busca: devolvemos o que deu e
          // marcamos como parcial. Nunca tela branca.
          partial = true;
          await this.dumpDebug(page, `place-${index}`, error);
        }

        if (index < urls.length - 1) await sleep(this.config.delayMs);
      }

      if (establishments.length === 0) {
        throw new PlacesUnavailableError(
          "Nenhuma ficha pôde ser lida — o layout do Google Maps provavelmente mudou.",
        );
      }

      return { query, establishments, fromCache: false, partial };
    } finally {
      await session.close();
    }
  }

  /** Abre a busca, rola o feed e devolve as URLs das fichas, sem repetição. */
  private async collectPlaceUrls(page: Page, query: SearchQuery, limit: number): Promise<string[]> {
    await page.goto(buildSearchUrl(query), { waitUntil: "domcontentloaded" });
    await this.acceptConsent(page);
    await this.assertNotBlocked(page);

    const feed = page.locator(SELECTORS.feed);
    try {
      await feed.waitFor({ state: "visible" });
    } catch (error) {
      // Busca com um único resultado forte cai direto na ficha, sem feed.
      if (page.url().includes("/maps/place/")) return [page.url()];
      await this.dumpDebug(page, "feed", error);
      throw new PlacesUnavailableError("A lista de resultados não carregou.", { cause: error });
    }

    const urls = new Set<string>();
    let stagnantRounds = 0;

    // Com raio, boa parte do que o Google devolve cai fora do círculo, então
    // juntamos mais links do que o teto pedido para sobrar o suficiente
    // depois do filtro.
    const target = query.center ? limit * 3 : limit;

    // Rola até juntar o suficiente, o Maps avisar que acabou, ou parar de
    // crescer — o teto de rodadas evita rolar para sempre num feed infinito.
    for (let round = 0; round < 30 && urls.size < target; round += 1) {
      // Medido ANTES de recolher: é a diferença entre as duas medidas que diz
      // se a rolagem anterior trouxe gente nova.
      const before = urls.size;

      const hrefs = await page
        .locator(SELECTORS.resultLink)
        .evaluateAll((links) => links.map((link) => (link as HTMLAnchorElement).href));
      for (const href of hrefs) urls.add(href);

      if (urls.size >= target) break;
      if (await page.locator(SELECTORS.feedEnd).count()) break;

      // O Maps carrega em lotes e intercala rodadas secas entre eles, então
      // uma rodada sem novidade não significa fim de lista. Quatro seguidas
      // (~5s de espera) é onde para de valer a pena insistir.
      stagnantRounds = round > 0 && urls.size === before ? stagnantRounds + 1 : 0;
      if (stagnantRounds >= 4) break;

      await feed.evaluate((node) => node.scrollBy(0, node.scrollHeight));
      await sleep(Math.max(this.config.delayMs, 800));
    }

    return this.withinRadius([...urls], query).slice(0, limit);
  }

  /**
   * Descarta os resultados fora do raio, ANTES de abrir as fichas.
   *
   * Os links do feed já trazem a coordenada do lugar (`!3d...!4d...`), então o
   * recorte custa zero: filtrar depois significaria gastar três segundos de
   * coleta em cada estabelecimento que seria jogado fora.
   *
   * Link sem coordenada legível fica — melhor um resultado a mais para o
   * usuário descartar do que sumir com algo que talvez servisse.
   */
  private withinRadius(urls: string[], query: SearchQuery): string[] {
    const center = query.center;
    if (!center) return urls;

    return urls.filter((url) => {
      const { lat, lng } = parseLatLng(url);
      if (lat === null || lng === null) return true;
      return distanceKm(center, { lat, lng }) <= center.radiusKm;
    });
  }

  /** Lê uma ficha e monta o `Establishment`. */
  private async scrapePlace(page: Page, url: string): Promise<Establishment> {
    await page.goto(url, { waitUntil: "domcontentloaded" });
    await this.assertNotBlocked(page);
    await page.locator(SELECTORS.detailName).first().waitFor({ state: "visible" });

    const currentUrl = page.url();
    const name =
      (await text(page.locator(SELECTORS.detailName).first())) ?? parseNameFromUrl(currentUrl);
    if (!name) {
      throw new PlacesUnavailableError(`Ficha sem nome legível: ${currentUrl}`);
    }

    const address = stripLabelPrefix(
      await attribute(page.locator(SELECTORS.addressButton).first(), "aria-label"),
    );
    const phoneRaw = parsePhoneFromItemId(
      await attribute(page.locator(SELECTORS.phoneButton).first(), "data-item-id"),
    );
    const phoneE164 = toE164(phoneRaw);
    const { neighborhood, city, state } = parseCityState(address);
    const { lat, lng } = parseLatLng(currentUrl);

    return {
      placeId: parsePlaceId(currentUrl) ?? currentUrl,
      name,
      category: await this.readCategory(page),
      address,
      neighborhood,
      city,
      state,
      lat,
      lng,
      phoneE164,
      whatsapp: guessWhatsapp(phoneE164),
      rating: parseRating(await attribute(page.locator(SELECTORS.ratingLabel).first(), "aria-label")),
      reviewsCount: parseReviewsCount(
        await attribute(page.locator(SELECTORS.reviewsLabel).first(), "aria-label"),
      ),
      source: "google-maps-scraper",
      scrapedAt: new Date().toISOString(),
    };
  }

  /**
   * Lê a categoria nos dois layouts que o Maps usa.
   *
   * Comércio comum traz um botão; hospedagem traz texto solto ao lado da nota,
   * precedido do separador "·", que tiramos aqui.
   */
  private async readCategory(page: Page): Promise<string | null> {
    const button = await text(page.locator(SELECTORS.categoryButton).first());
    if (button) return button;

    const fallback = await text(page.locator(SELECTORS.categoryFallback).first());
    return fallback?.replace(/^[·•\s]+/, "").trim() || null;
  }

  /**
   * Dispensa o muro de cookies, quando aparece.
   *
   * Não achar o botão não é erro: na maior parte dos IPs brasileiros o muro
   * nem chega a ser exibido.
   */
  private async acceptConsent(page: Page): Promise<void> {
    const button = page.locator(SELECTORS.consentButton).first();
    try {
      await button.waitFor({ state: "visible", timeout: 3_000 });
      await button.click();
      await page.waitForLoadState("domcontentloaded");
    } catch {
      return;
    }
  }

  /**
   * Interrompe cedo quando o Google serviu CAPTCHA em vez de resultado.
   *
   * Distinguir bloqueio de "layout mudou" importa: bloqueio pede proxy e
   * espera, layout pede conserto em `selectors.ts`.
   */
  private async assertNotBlocked(page: Page): Promise<void> {
    if (await page.locator(SELECTORS.blocked).count()) {
      throw new PlacesBlockedError(
        "O Google apresentou CAPTCHA — considere usar proxy ou reduzir o ritmo.",
      );
    }

    const haystack = `${page.url()} ${await page.title()}`.toLowerCase();
    if (BLOCK_PHRASES.some((phrase) => haystack.includes(phrase))) {
      throw new PlacesBlockedError(
        "O Google sinalizou tráfego incomum — considere usar proxy ou reduzir o ritmo.",
      );
    }
  }

  /** Screenshot + HTML quando algo falha, se `SCRAPER_DEBUG_DIR` estiver setado. */
  private async dumpDebug(page: Page, label: string, error: unknown): Promise<void> {
    if (!this.config.debugDir) return;

    try {
      const dir = join(this.config.debugDir, new Date().toISOString().replace(/[:.]/g, "-"));
      await mkdir(dir, { recursive: true });
      await page.screenshot({ path: join(dir, `${label}.png`) });
      await writeFile(join(dir, `${label}.html`), await page.content(), "utf8");
      await writeFile(join(dir, `${label}.txt`), `${page.url()}\n\n${String(error)}`, "utf8");
    } catch {
      // Debug nunca pode ser o motivo de uma busca falhar.
    }
  }
}

/** Texto de um elemento que pode não existir. */
async function text(locator: Locator): Promise<string | null> {
  if (!(await locator.count())) return null;
  return (await locator.textContent())?.trim() || null;
}

/** Atributo de um elemento que pode não existir. */
async function attribute(locator: Locator, name: string): Promise<string | null> {
  if (!(await locator.count())) return null;
  return await locator.getAttribute(name);
}
