import { INITIAL_STATE, type QuoteState } from "./state";

/**
 * A cotação sobrevive a refresh e a fechar a aba.
 *
 * Sem login, `localStorage` é a única memória que existe. Quem quiser levar a
 * cotação para outro aparelho usa o link de retomada.
 */

const KEY = "cota-ai:quote:v1";

export function loadState(): QuoteState | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as Partial<QuoteState>;
    if (!Array.isArray(parsed.establishments)) return null;

    return {
      ...INITIAL_STATE,
      ...parsed,
      search: {
        ...INITIAL_STATE.search,
        ...parsed.search,
        // Uma busca gravada como "running" era uma busca interrompida pelo
        // refresh. Restaurar esse estado deixaria um spinner girando para
        // sempre, esperando uma resposta que ninguém mais vai entregar.
        status: parsed.search?.status === "running" ? "done" : (parsed.search?.status ?? "idle"),
      },
    };
  } catch {
    // Storage corrompido ou bloqueado (aba anônima, cookies desligados):
    // começar do zero é melhor do que não abrir a página.
    return null;
  }
}

export function saveState(state: QuoteState): void {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    // Cota estourada: a busca continua funcionando, só não sobrevive ao refresh.
  }
}

export function clearState(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    // Nada a fazer — e nada que justifique quebrar a tela.
  }
}
