/**
 * Categorias de estabelecimento oferecidas na busca (RF-01).
 *
 * Derivadas da taxonomia oficial do Google Places (a tabela de `place types`,
 * 507 tipos), mas nem traduzidas nem copiadas ao pé da letra:
 *
 * - Escritas como o termo que funciona na BUSCA do Google Maps em português
 *   ("oficina mecânica"), não como o identificador da API (`car_repair`).
 * - Filtradas pelo que faz sentido COTAR. A taxonomia tem 117 subtipos de
 *   restaurante, além de aeroporto, arquipélago e cemitério — nada disso é
 *   coisa de que se pede orçamento em massa pelo WhatsApp.
 *
 * A lista é um atalho, não uma amarra: o campo aceita texto livre no fim, e é
 * assim que aparecem as categorias que ninguém previu aqui.
 *
 * Não usamos as categorias que o scraper já coletou como sugestão: o Google
 * REPORTA "Hotel 2 estrelas" na ficha, mas quem BUSCA por isso encontra menos
 * que quem busca "pousada". O que se reporta e o que se pesquisa são
 * vocabulários diferentes.
 */

export interface CategoryGroup {
  label: string;
  options: readonly string[];
}

export const CATEGORY_GROUPS: readonly CategoryGroup[] = [
  {
    label: "Hospedagem",
    options: ["pousada", "hotel", "hostel", "resort", "casa de temporada", "chalé", "camping"],
  },
  {
    label: "Eventos e festas",
    options: [
      "buffet",
      "salão de festas",
      "espaço para eventos",
      "cerimonial",
      "decoração de festas",
      "fotógrafo",
      "filmagem de eventos",
      "bolos e doces para festa",
      "aluguel de mesas e cadeiras",
      "brinquedos para festa",
      "banda para eventos",
      "bartender",
    ],
  },
  {
    label: "Alimentação",
    options: [
      "restaurante",
      "pizzaria",
      "churrascaria",
      "padaria",
      "confeitaria",
      "lanchonete",
      "food truck",
      "açougue",
      "hortifruti",
      "distribuidora de bebidas",
      "marmitaria",
    ],
  },
  {
    label: "Casa e reforma",
    options: [
      "material de construção",
      "marcenaria",
      "serralheria",
      "vidraçaria",
      "eletricista",
      "encanador",
      "pintor",
      "gesso e drywall",
      "piso e revestimento",
      "ar-condicionado",
      "dedetizadora",
      "jardinagem",
      "piscina",
      "empresa de mudança",
      "limpeza pós-obra",
    ],
  },
  {
    label: "Automotivo",
    options: [
      "oficina mecânica",
      "funilaria e pintura",
      "auto elétrica",
      "borracharia",
      "autopeças",
      "lava-rápido",
      "guincho",
      "insulfilm",
    ],
  },
  {
    label: "Saúde e bem-estar",
    options: [
      "clínica médica",
      "dentista",
      "fisioterapia",
      "veterinário",
      "pet shop",
      "academia",
      "salão de beleza",
      "barbearia",
      "clínica de estética",
    ],
  },
  {
    label: "Serviços profissionais",
    options: [
      "gráfica",
      "contabilidade",
      "advocacia",
      "imobiliária",
      "corretora de seguros",
      "assistência técnica",
      "chaveiro",
      "transportadora",
      "agência de viagens",
      "tradutor",
      "segurança e portaria",
    ],
  },
  {
    label: "Comércio",
    options: [
      "floricultura",
      "papelaria",
      "farmácia",
      "supermercado",
      "loja de roupas",
      "loja de móveis",
      "loja de material de limpeza",
      "uniformes",
      "ótica",
      "joalheria",
      "loja de brinquedos",
      "loja de informática",
    ],
  },
];

/** Valor da opção que libera o campo de texto livre. */
export const CUSTOM_CATEGORY = "__outra__";

const ALL = new Set(CATEGORY_GROUPS.flatMap((group) => group.options));

/** `true` quando a categoria não está na lista — ou seja, foi digitada. */
export function isCustomCategory(category: string): boolean {
  return category.length > 0 && !ALL.has(category);
}
