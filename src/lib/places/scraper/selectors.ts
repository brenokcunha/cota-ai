import { zoomForRadiusKm } from "../../geo";
import type { SearchQuery } from "../types";

/**
 * Todo o acoplamento com o HTML do Google Maps mora neste arquivo.
 *
 * O risco #2 do projeto é o Google mudar o layout. A mitigação é esta: quando
 * quebrar, o conserto é aqui e em nenhum outro lugar. Por isso preferimos
 * seletores semânticos (role, aria-label, data-item-id) às classes ofuscadas
 * do tipo `.F7nice`, que mudam a cada deploy do Google.
 */

/**
 * Página de busca, em pt-BR, sem redirecionar para a versão mobile.
 *
 * Duas formas, conforme o usuário disse onde procurar:
 *
 * - por texto: `?query=pousada em Paraty RJ`, que é o Maps resolvendo a região;
 * - por ponto: `/pousada/@lat,lng,Nz`, que centra o mapa e busca ao redor.
 *
 * O caminho por ponto é o que permite raio sem Places API: o zoom aproxima a
 * área, e o recorte exato sai depois, por distância.
 */
export function buildSearchUrl(query: SearchQuery): string {
  if (query.center) {
    const { lat, lng, radiusKm } = query.center;
    const zoom = zoomForRadiusKm(radiusKm, lat);
    const term = encodeURIComponent(query.category.trim());
    return `https://www.google.com/maps/search/${term}/@${lat},${lng},${zoom}z?hl=pt-BR&gl=BR`;
  }

  const url = new URL("https://www.google.com/maps/search/");
  url.searchParams.set("api", "1");
  url.searchParams.set("query", `${query.category} em ${query.region}`.trim());
  url.searchParams.set("hl", "pt-BR");
  url.searchParams.set("gl", "BR");
  return url.toString();
}

export const SELECTORS = {
  /** Muro de consentimento de cookies (aparece em IP europeu e às vezes no BR). */
  consentButton: [
    'button[aria-label*="Aceitar tudo"]',
    'button[aria-label*="Accept all"]',
    'form[action*="consent.google.com"] button',
  ].join(", "),

  /** Coluna de resultados da busca. Se sumir, a busca não carregou. */
  feed: 'div[role="feed"]',

  /** Cada resultado é um link para a ficha do estabelecimento. */
  resultLink: 'div[role="feed"] a[href*="/maps/place/"]',

  /** Marcador de fim da rolagem ("Você chegou ao final da lista"). */
  feedEnd: "span.HlvSq",

  /** Nome do estabelecimento na ficha. */
  detailName: 'div[role="main"] h1',

  /**
   * Botões de contato da ficha. `data-item-id` é semântico e sobreviveu a
   * várias mudanças de layout — é o seletor mais estável que o Maps oferece.
   */
  phoneButton: 'button[data-item-id^="phone:tel:"]',
  addressButton: 'button[data-item-id="address"]',

  /** Nota: o aria-label vem como "4,5 estrelas". */
  ratingLabel: 'div[role="main"] span[role="img"][aria-label*="estrela"]',

  /** Contagem de avaliações: aria-label "1.234 avaliações". */
  reviewsLabel: 'div[role="main"] [aria-label*="avaliaç"], div[role="main"] [aria-label*="comentário"]',

  /**
   * Categoria declarada pelo estabelecimento ("Floricultura", "Restaurante").
   * Comercio comum traz um botao clicavel com a categoria.
   */
  categoryButton: 'div[role="main"] button[jsaction*=".category"]',

  /**
   * Hospedagem usa outro layout: nao ha botao de categoria, e sim um texto
   * solto ao lado da nota ("Hotel 2 estrelas", "Pousada"). A classe e ofuscada
   * e vai quebrar — mas categoria e campo opcional, entao quebra vira null e
   * nao vira erro.
   */
  categoryFallback: 'div[role="main"] span.mgr77e',

  /** Sinais de bloqueio: CAPTCHA ou página de "tráfego incomum". */
  blocked: 'form#captcha-form, div#recaptcha, iframe[src*="recaptcha"]',
} as const;

/** Termos que indicam bloqueio quando aparecem no <title> ou no corpo. */
export const BLOCK_PHRASES = [
  "unusual traffic",
  "tráfego incomum",
  "our systems have detected",
  "sorry/index",
];
