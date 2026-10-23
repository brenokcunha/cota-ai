import ibge from "./ibge.json";

/**
 * Municípios e distritos brasileiros, do IBGE.
 *
 * Distritos estão aqui porque destino turístico muitas vezes não é município:
 * Caraíva, Trancoso e Arraial D'Ajuda são distritos de Porto Seguro. Sem eles
 * a busca por nome não acha, e sobra ao usuário navegar o mapa até o lugar.
 *
 * Só o servidor importa este módulo — os 303KB não entram no bundle do cliente.
 *
 * O IBGE **não** publica lista de bairros: tem municípios, distritos e apenas
 * 646 subdistritos, que não incluem Moema nem Ipanema. Bairro vem do endereço
 * dos estabelecimentos já coletados, em `suggestKnownRegions`.
 *
 * Para atualizar: `node scripts/build-ibge-regions.mjs`.
 */

interface Entrada {
  /** Como aparece na tela e vai para a busca: "Paraty RJ", "Caraíva, Porto Seguro BA". */
  label: string;
  /** Nome sem acento e em minúsculas, para casar com o que foi digitado. */
  normalized: string;
}

interface Indice {
  municipios: Entrada[];
  distritos: Entrada[];
}

let indice: Indice | null = null;

function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/** Normaliza uma vez só, na primeira busca, e reaproveita depois. */
function getIndice(): Indice {
  if (indice) return indice;

  // O JSON guarda tuplas para ocupar menos espaço: `[nome, uf]` para município
  // e `[nome, municipio, uf]` para distrito.
  const dados = ibge as { municipios: string[][]; distritos: string[][] };

  indice = {
    municipios: dados.municipios.map((linha) => ({
      label: `${linha[0]} ${linha[1]}`,
      normalized: normalize(linha[0]),
    })),
    distritos: dados.distritos.map((linha) => ({
      label: `${linha[0]}, ${linha[1]} ${linha[2]}`,
      normalized: normalize(linha[0]),
    })),
  };

  return indice;
}

function porPrefixo(entradas: Entrada[], normalized: string, limit: number): string[] {
  const found: string[] = [];
  for (const entrada of entradas) {
    if (!entrada.normalized.startsWith(normalized)) continue;
    found.push(entrada.label);
    if (found.length >= limit) break;
  }
  return found;
}

/**
 * Municípios cujo nome começa com o texto digitado.
 *
 * Só prefixo, e não "contém": digitar "sao" deve sugerir "São Paulo", não os
 * cento e tantos municípios com "são" no meio do nome.
 */
export function searchMunicipios(prefix: string, limit = 4): string[] {
  const normalized = normalize(prefix);
  if (normalized.length < 2) return [];
  return porPrefixo(getIndice().municipios, normalized, limit);
}

/**
 * Distritos cujo nome começa com o texto digitado.
 *
 * Ficam numa consulta separada de propósito: se disputassem as mesmas vagas
 * que os municípios, "cara" encheria a lista de Caraá, Caraguatatuba e
 * Carambeí antes de chegar em Caraíva.
 */
export function searchDistritos(prefix: string, limit = 4): string[] {
  const normalized = normalize(prefix);
  if (normalized.length < 2) return [];
  return porPrefixo(getIndice().distritos, normalized, limit);
}
