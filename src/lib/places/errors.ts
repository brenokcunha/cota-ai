/**
 * Erros de domínio da busca.
 *
 * A UI e as rotas tratam estes tipos, nunca erros do Playwright: trocar a
 * fonte de dados (PRD §6.2) não pode obrigar a reescrever tratamento de erro.
 */

export class PlacesError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = new.target.name;
  }
}

/** A fonte identificou automação e recusou responder (CAPTCHA, bloqueio de IP). */
export class PlacesBlockedError extends PlacesError {}

/** A fonte respondeu, mas não conseguimos extrair nada de útil. */
export class PlacesUnavailableError extends PlacesError {}
