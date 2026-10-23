/**
 * Funções puras que traduzem o texto cru do Google Maps para o domínio.
 *
 * Ficam separadas do Playwright de propósito: são elas que quebram quando o
 * Google muda formato, e são as únicas testáveis sem subir um browser
 * (os testes de contrato batem aqui).
 */

/**
 * Extrai o identificador de feature da URL da ficha (o `0x...:0x...` que o
 * Maps carrega em `!1s`). Não é o `place_id` da Places API, mas é estável
 * entre buscas e serve como chave de deduplicação.
 */
export function parsePlaceId(url: string): string | null {
  // O `place_id` de verdade (`ChIJ...`) vem em `!19s`. E o mesmo id que a
  // Places API usa, entao guardar ele agora e o que vai permitir trocar de
  // fonte sem reidentificar a base inteira.
  const placeId = url.match(/!19s(ChIJ[\w-]+)/);
  if (placeId) return placeId[1];

  // Sem ele, o feature id `0x...:0x...` de `!1s` serve para deduplicar.
  const featureId = url.match(/!1s(0x[0-9a-f]+:0x[0-9a-f]+)/i);
  if (featureId) return featureId[1];

  return null;
}

/** Nome legível a partir do slug da URL, quando o `h1` não carregou. */
export function parseNameFromUrl(url: string): string | null {
  const slug = url.match(/\/maps\/place\/([^/@]+)/);
  if (!slug) return null;
  try {
    return decodeURIComponent(slug[1].replace(/\+/g, " ")).trim() || null;
  } catch {
    return null;
  }
}

/** `data-item-id="phone:tel:+55 24 3371-1234"` -> `+55 24 3371-1234`. */
export function parsePhoneFromItemId(itemId: string | null): string | null {
  if (!itemId) return null;
  const match = itemId.match(/^phone:tel:(.+)$/);
  return match ? match[1].trim() : null;
}

/** `"4,5 estrelas"` -> `4.5`. Aceita ponto ou vírgula como separador. */
export function parseRating(label: string | null): number | null {
  if (!label) return null;
  const match = label.match(/(\d+[.,]?\d*)/);
  if (!match) return null;
  const value = Number(match[1].replace(",", "."));
  return Number.isFinite(value) && value >= 0 && value <= 5 ? value : null;
}

/** `"1.234 avaliações"` / `"(1.234)"` -> `1234`. */
export function parseReviewsCount(label: string | null): number | null {
  if (!label) return null;
  const match = label.match(/([\d.\s]+)/);
  if (!match) return null;
  const value = Number(match[1].replace(/[.\s]/g, ""));
  return Number.isInteger(value) && value >= 0 ? value : null;
}

/**
 * Separa bairro, cidade e UF do endereço.
 *
 * O Google escreve endereço brasileiro como
 * `"R. X, 29 - Centro, Paraty - RJ, 23970-000"`: o bairro vem colado ao número,
 * depois de um hífen, e a cidade vem antes da UF.
 *
 * Cada campo sai `null` quando não dá para afirmar. Cidade errada estraga o
 * filtro por região, e bairro errado estraga a sugestão de busca — em ambos os
 * casos, não saber é melhor do que chutar.
 */
export function parseCityState(address: string | null): {
  neighborhood: string | null;
  city: string | null;
  state: string | null;
} {
  if (!address) return { neighborhood: null, city: null, state: null };

  const parts = address.split(",").map((p) => p.trim());

  // Forma mais comum: um trecho inteiro no formato `Cidade - UF`.
  for (let i = parts.length - 1; i >= 0; i -= 1) {
    const match = parts[i].match(/^(.+?)\s+-\s+([A-Z]{2})$/);
    if (!match) continue;
    return {
      neighborhood: neighborhoodFrom(parts[i - 1]),
      city: match[1].trim(),
      state: match[2],
    };
  }

  // Endereços sem número saem como `R. X - Paraty, RJ`: a UF fica sozinha num
  // trecho e a cidade é o rabo do trecho anterior. Aí não sobra bairro.
  for (let i = parts.length - 1; i > 0; i -= 1) {
    if (!/^[A-Z]{2}$/.test(parts[i])) continue;
    const city = parts[i - 1].split(/\s+-\s+/).pop()?.trim();
    if (city) return { neighborhood: null, city, state: parts[i] };
  }

  return { neighborhood: null, city: null, state: null };
}

/**
 * `"364 - Moema"` -> `"Moema"`. Trecho sem hífen não carrega bairro.
 *
 * Fica com o ÚLTIMO segmento, não o segundo: endereço com número de loja tem
 * hífen a mais — `"955 - Lj 01 - Bento Ferreira"` — e o bairro é sempre o que
 * vem por último.
 */
function neighborhoodFrom(part: string | undefined): string | null {
  if (!part) return null;

  const segments = part.split(/\s+-\s+/);
  if (segments.length < 2) return null;

  const candidate = segments[segments.length - 1].trim();
  if (!candidate) return null;

  // Número solto ou CEP que caiu na posição do bairro não é bairro.
  if (/^[\d\s-]+$/.test(candidate)) return null;

  return candidate;
}

/** Remove o prefixo que o Maps põe no aria-label: `"Endereço: R. X, 29"`. */
export function stripLabelPrefix(label: string | null): string | null {
  if (!label) return null;
  const cleaned = label.replace(/^[^:]{0,30}:\s*/, "").trim();
  return cleaned || null;
}

/**
 * Coordenadas do estabelecimento.
 *
 * Preferimos `!3d<lat>!4d<lng>`, que e a posicao do lugar. O `@lat,lng` da URL
 * e so o centro do mapa na tela — perto, mas nao o mesmo ponto — e por isso
 * fica como ultimo recurso.
 */
export function parseLatLng(url: string): { lat: number | null; lng: number | null } {
  const place = url.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/);
  if (place) return { lat: Number(place[1]), lng: Number(place[2]) };

  const viewport = url.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (viewport) return { lat: Number(viewport[1]), lng: Number(viewport[2]) };

  return { lat: null, lng: null };
}
