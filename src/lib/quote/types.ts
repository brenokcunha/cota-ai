import type { Establishment } from "../places/types";

/**
 * A cotação: a lista escolhida, a mensagem, e onde o disparo parou.
 *
 * Vive no `localStorage` do navegador (RF-07) e só vai para o banco quando o
 * usuário pede o link de retomada (RF-08). Não há login: o `shareToken` é a
 * única chave de volta.
 */

export type TargetStatus = "pending" | "sent" | "skipped";

export interface QuoteTarget {
  establishment: Establishment;
  status: TargetStatus;
  sentAt: string | null;
}

export interface Quote {
  shareToken: string;
  category: string;
  region: string;
  template: string;
  variables: Record<string, string>;
  targets: QuoteTarget[];
}

/** O que a tela manda para gravar. Sem `shareToken`, cria uma cotação nova. */
export interface QuoteInput {
  shareToken?: string | null;
  category: string;
  region: string;
  template: string;
  variables: Record<string, string>;
  targets: QuoteTarget[];
}
