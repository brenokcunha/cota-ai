/**
 * Templates prontos por categoria.
 *
 * Todos seguem a mesma forma: quem escreve se identifica, diz o que precisa,
 * e faz UMA pergunta objetiva. Mensagem que parece disparo automático não é
 * respondida — e a resposta é o produto inteiro.
 *
 * `{{nome}}` é preenchido pelo sistema; as outras variáveis viram campos que o
 * usuário preenche uma vez e valem para a cotação toda.
 */

export interface MessageTemplate {
  id: string;
  label: string;
  /** Descrição curta para a tela de escolha. */
  hint: string;
  body: string;
  /** Variáveis sugeridas, já criadas como campos vazios ao escolher o template. */
  variables: string[];
}

export const TEMPLATES: readonly MessageTemplate[] = [
  {
    id: "hospedagem",
    label: "Hospedagem",
    hint: "Pousadas, hotéis, casas de temporada",
    variables: ["datas", "pessoas"],
    body:
      "Olá, {{nome}}! Tudo bem?\n\n" +
      "Estou organizando uma viagem para {{datas}}, somos {{pessoas}} pessoas.\n\n" +
      "Vocês têm disponibilidade nesse período? Se sim, qual o valor da diária?\n\n" +
      "Obrigado!",
  },
  {
    id: "evento",
    label: "Evento",
    hint: "Buffet, salão, decoração, fotografia",
    variables: ["evento", "data", "convidados"],
    body:
      "Olá, {{nome}}! Tudo bem?\n\n" +
      "Estou organizando {{evento}} no dia {{data}}, para cerca de {{convidados}} pessoas.\n\n" +
      "Vocês atendem nessa data? Poderiam me passar um orçamento?\n\n" +
      "Obrigado!",
  },
  {
    id: "produto",
    label: "Produto",
    hint: "Comércio em geral, quando o que importa é preço e prazo",
    variables: ["produto", "quantidade"],
    body:
      "Olá, {{nome}}! Tudo bem?\n\n" +
      "Estou procurando {{produto}} — quantidade: {{quantidade}}.\n\n" +
      "Vocês têm disponível? Qual o valor e o prazo de entrega?\n\n" +
      "Obrigado!",
  },
  {
    id: "servico",
    label: "Serviço",
    hint: "Oficina, reforma, manutenção, assistência",
    variables: ["servico", "prazo"],
    body:
      "Olá, {{nome}}! Tudo bem?\n\n" +
      "Preciso de {{servico}} e gostaria de fazer até {{prazo}}.\n\n" +
      "Vocês atendem esse tipo de serviço? Qual seria o valor?\n\n" +
      "Obrigado!",
  },
];

export function findTemplate(id: string): MessageTemplate | undefined {
  return TEMPLATES.find((template) => template.id === id);
}

/** Nomes de variável usados num template, na ordem em que aparecem. */
export function extractVariables(body: string): string[] {
  const found = new Set<string>();
  for (const match of body.matchAll(/\{\{\s*([\w-]+)\s*\}\}/g)) {
    found.add(match[1]);
  }
  return [...found];
}
