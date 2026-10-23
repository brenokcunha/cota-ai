/**
 * Baixa municípios e distritos do IBGE e grava a versão enxuta que a aplicação
 * usa no autocomplete.
 *
 *   node scripts/build-ibge-regions.mjs
 *
 * O arquivo gerado é versionado de propósito: buscar a API do IBGE em tempo de
 * request colocaria um serviço de terceiros no caminho de cada tecla digitada,
 * e essa lista muda de década em década.
 *
 * Distritos importam porque muito destino turístico não é município: Caraíva e
 * Trancoso são distritos de Porto Seguro, e sem eles a busca por nome não
 * acha — sobra navegar o mapa até lá.
 *
 * O IBGE **não** tem lista de bairros. Tem municípios (5.571), distritos
 * (10.751) e 646 subdistritos, e os subdistritos não incluem Moema nem
 * Ipanema. Bairro, no cota-ai, sai do endereço dos estabelecimentos coletados.
 */

import { writeFile } from "node:fs/promises";

const BASE = "https://servicodados.ibge.gov.br/api/v1/localidades";
/** Agregado 6579 / variável 9324: população estimada por município. */
const POPULACAO =
  "https://servicodados.ibge.gov.br/api/v3/agregados/6579/periodos/-1/variaveis/9324?localidades=N6[all]";
const DESTINO = "src/lib/regions/ibge.json";

async function baixar(url) {
  const response = await fetch(url.startsWith("http") ? url : `${BASE}/${url}`);
  if (!response.ok) throw new Error(`IBGE respondeu ${response.status} em ${url}.`);
  return response.json();
}

/** A UF fica enterrada em dois caminhos diferentes conforme o recorte. */
function uf(municipio) {
  return (
    municipio?.microrregiao?.mesorregiao?.UF?.sigla ??
    municipio?.["regiao-imediata"]?.["regiao-intermediaria"]?.UF?.sigla ??
    null
  );
}

console.log("Baixando municípios…");
const municipiosRaw = await baixar("municipios?orderBy=nome");

console.log("Baixando distritos…");
const distritosRaw = await baixar("distritos?orderBy=nome");

console.log("Baixando população…");
const populacaoRaw = await baixar(POPULACAO);

// A ordem do arquivo É a ordem de relevância do autocomplete: a busca varre a
// lista e para nas primeiras N que casam com o prefixo. Em ordem alfabética,
// digitar "rio" traria Rio Acima, Rio Azul e Rio Bananal — e nunca Rio de
// Janeiro. Por população, traz o que a pessoa quase sempre procurava.
const habitantes = new Map();
for (const serie of populacaoRaw[0]?.resultados?.[0]?.series ?? []) {
  const valor = Object.values(serie.serie ?? {})[0];
  habitantes.set(String(serie.localidade?.id), Number(valor) || 0);
}

// Pares [nome, UF]. O JSON completo do IBGE tem 2,4MB de microrregião,
// mesorregião e região intermediária, que não servem para nada aqui.
const municipios = municipiosRaw
  .map((m) => [m.nome, uf(m), habitantes.get(String(m.id)) ?? 0])
  .filter(([nome, sigla]) => nome && sigla)
  .sort((a, b) => b[2] - a[2] || a[0].localeCompare(b[0], "pt-BR"))
  .map(([nome, sigla]) => [nome, sigla]);

const conhecidos = new Set(municipios.map(([nome, sigla]) => `${nome}|${sigla}`));

// Trios [nome, município, UF]. Distrito que tem o mesmo nome do município é a
// sede — não acrescenta nada ao autocomplete e sairia duplicado na lista.
// Distrito não tem população própria no IBGE; a do município é a melhor
// aproximação disponível, e coloca Caraíva (Porto Seguro) à frente de
// Caraíba (Seara), que é o desempate certo.
const distritos = distritosRaw
  .map((d) => [d.nome, d.municipio?.nome, uf(d.municipio), habitantes.get(String(d.municipio?.id)) ?? 0])
  .filter(([nome, municipio, sigla]) => nome && municipio && sigla && nome !== municipio)
  .filter(([nome, , sigla]) => !conhecidos.has(`${nome}|${sigla}`))
  .sort((a, b) => b[3] - a[3] || a[0].localeCompare(b[0], "pt-BR"))
  .map(([nome, municipio, sigla]) => [nome, municipio, sigla]);

const conteudo = { municipios, distritos };
await writeFile(DESTINO, `${JSON.stringify(conteudo)}\n`, "utf8");

const kb = Math.round(Buffer.byteLength(JSON.stringify(conteudo)) / 1024);
console.log(
  `${municipios.length} municípios e ${distritos.length} distritos gravados em ${DESTINO} (${kb} KB).`,
);
console.log(
  `${distritosRaw.length - distritos.length} distrito(s) descartado(s) por serem sede ou repetirem um município.`,
);
