import type { Establishment } from "./places/types";

/**
 * Montagem da mensagem e do deep link de envio.
 *
 * O envio nunca é automatizado: geramos o link, o usuário confirma o disparo no
 * próprio WhatsApp dele. Essa é a decisão fundamental do produto (PRD §6.1) —
 * é o que mantém o cota-ai dentro dos Termos e faz a resposta chegar direto no
 * usuário, sem precisarmos construir um inbox.
 */

/** Variáveis que o usuário pode usar no template, além das próprias dele. */
export const BUILTIN_VARIABLES = ["nome"] as const;

/**
 * Substitui `{{variavel}}` pelos valores informados.
 *
 * Placeholder sem valor correspondente é removido em vez de aparecer cru na
 * mensagem — melhor uma frase incompleta que um "{{data}}" enviado ao cliente.
 */
export function renderTemplate(template: string, variables: Record<string, string>): string {
  return template.replace(/\{\{\s*([\w-]+)\s*\}\}/g, (_match, key: string) => variables[key] ?? "");
}

/** Mensagem final para um estabelecimento específico. */
export function renderMessageFor(
  template: string,
  establishment: Establishment,
  variables: Record<string, string> = {},
): string {
  return renderTemplate(template, { ...variables, nome: establishment.name });
}

/**
 * Deep link do WhatsApp com a mensagem pré-preenchida.
 *
 * wa.me exige o número só com dígitos, sem o "+" do E.164.
 */
export function buildWhatsappLink(phoneE164: string, message: string): string {
  const digits = phoneE164.replace(/\D/g, "");
  if (!digits) {
    throw new Error("Telefone inválido para deep link do WhatsApp.");
  }
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}
