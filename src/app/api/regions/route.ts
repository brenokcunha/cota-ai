import { hasDatabase } from "@/lib/db/pool";
import { suggestKnownRegions } from "@/lib/places/repository";
import { searchDistritos, searchMunicipios } from "@/lib/regions/ibge";

/**
 * RF-01 — autocomplete de região.
 *
 * `GET /api/regions?q=cara` -> `{"regions":["Caraguatatuba SP","Caraíva, Porto Seguro BA", …]}`
 *
 * Três fontes, cada uma com vagas próprias:
 *
 * 1. Bairros e cidades que já apareceram em alguma coleta nossa. São regiões
 *    comprovadamente pesquisáveis, e bairro é a granularidade que mais serve
 *    para cotar.
 * 2. Municípios do IBGE (5.571), que cobrem o Brasil desde o primeiro uso.
 * 3. Distritos do IBGE (5.108) — Caraíva, Trancoso, Arraial D'Ajuda. Sem eles,
 *    destino turístico que não é município simplesmente não aparece.
 *
 * As vagas são divididas em vez de disputadas: numa lista única ordenada por
 * nome, "cara" encheria tudo de Caraá, Caraguatatuba e Carambeí antes de
 * chegar em Caraíva, que é justamente o que a pessoa procurava.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VAGAS = { base: 3, municipios: 3, distritos: 3 };

export async function GET(request: Request) {
  const q = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) return Response.json({ regions: [] });

  // Autocomplete quebrado não pode impedir a busca: sem banco, ou com ele fora
  // do ar, o IBGE sozinho já dá uma lista útil.
  const conhecidas = hasDatabase()
    ? await suggestKnownRegions(q, VAGAS.base).catch((error) => {
        console.error("[api/regions] falha ao consultar a base", error);
        return [];
      })
    : [];

  const regions: string[] = [];
  // Deduplica ignorando acento e caixa: o Google escreve "Caraiva" no endereço
  // e o IBGE registra "Caraíva", e mostrar as duas na lista faria a pessoa
  // achar que são lugares diferentes. Vence a primeira, que vem da nossa base
  // e portanto já provou que devolve resultado.
  const vistas = new Set<string>();
  const chave = (valor: string) =>
    valor
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .toLowerCase()
      .replace(/\s+/g, " ")
      .trim();

  const adicionar = (candidatos: string[]) => {
    for (const candidato of candidatos) {
      const k = chave(candidato);
      if (vistas.has(k)) continue;
      vistas.add(k);
      regions.push(candidato);
    }
  };

  adicionar(conhecidas);
  adicionar(searchMunicipios(q, VAGAS.municipios));
  adicionar(searchDistritos(q, VAGAS.distritos));

  return Response.json({ regions });
}
