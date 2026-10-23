"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useReducer,
  useRef,
  type ReactNode,
} from "react";

import type { Establishment, SearchCenter } from "@/lib/places/types";
import {
  INITIAL_STATE,
  quoteReducer,
  selectedTargets,
  type QuoteAction,
  type QuoteState,
} from "@/lib/quote/state";
import { loadState, saveState } from "@/lib/quote/storage";

/**
 * A cotação inteira, num contexto só.
 *
 * As três telas (lista, mensagem, disparo) são passos do mesmo trabalho, e o
 * usuário vai e volta entre elas. Estado por página obrigaria a repassar tudo
 * por URL, que é justamente o que o link de retomada já faz — e só
 * quando o usuário pede.
 */

interface QuoteContextValue {
  state: QuoteState;
  dispatch: (action: QuoteAction) => void;
  search(params: SearchParams): Promise<void>;
  cancelSearch(): void;
  /** Grava a cotação e devolve a URL de retomada. */
  createShareLink(): Promise<string>;
}

export interface SearchParams {
  category: string;
  /** Rótulo da região. No modo mapa, o servidor gera um se vier vazio. */
  region: string;
  limit: number;
  /** Área do mapa. `null` quando a busca é por texto. */
  center: SearchCenter | null;
}

const QuoteContext = createContext<QuoteContextValue | null>(null);

export function QuoteProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(quoteReducer, INITIAL_STATE);
  const abortRef = useRef<AbortController | null>(null);

  // Restaura antes de qualquer interação. Só no cliente: `localStorage` não
  // existe no servidor, e ler durante o render quebraria a hidratação.
  useEffect(() => {
    dispatch({ type: "hydrate", state: loadState() });
  }, []);

  // Grava a cada mudança. Antes de hidratar não grava, senão o estado
  // inicial vazio sobrescreveria o que estava salvo.
  useEffect(() => {
    if (state.hydrated) saveState(state);
  }, [state]);

  const cancelSearch = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
  }, []);

  const search = useCallback(
    async ({ category, region, limit, center }: SearchParams) => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      dispatch({ type: "search/start", category, region, limit, center });

      const params = new URLSearchParams({ categoria: category, limite: String(limit) });
      if (region) params.set("regiao", region);
      if (center) {
        params.set("lat", String(center.lat));
        params.set("lng", String(center.lng));
        params.set("raio", String(center.radiusKm));
      }
      const url = `/api/search?${params}`;

      try {
        const response = await fetch(url, {
          headers: { accept: "application/x-ndjson" },
          signal: controller.signal,
        });

        // Erro de validação vem como JSON com status, antes de o stream começar.
        if (!response.ok || !response.body) {
          const body = (await response.json().catch(() => null)) as { error?: string } | null;
          dispatch({ type: "search/error", message: body?.error ?? "A busca falhou." });
          return;
        }

        for await (const event of readNdjson(response.body, controller.signal)) {
          applyEvent(event, dispatch);
        }
      } catch (error) {
        // Cancelamento é escolha do usuário, não falha para exibir.
        if (controller.signal.aborted) return;
        dispatch({
          type: "search/error",
          message: error instanceof Error ? error.message : "A busca falhou.",
        });
      } finally {
        if (abortRef.current === controller) abortRef.current = null;
      }
    },
    [],
  );

  const createShareLink = useCallback(async () => {
    const response = await fetch("/api/quotes", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        shareToken: state.shareToken,
        category: state.category,
        region: state.region,
        template: state.template,
        variables: state.variables,
        targets: selectedTargets(state),
      }),
    });

    const body = (await response.json()) as { shareToken?: string; error?: string };
    if (!response.ok || !body.shareToken) {
      throw new Error(body.error ?? "Não foi possível gerar o link.");
    }

    dispatch({ type: "share/token", token: body.shareToken });
    return `${window.location.origin}/c/${body.shareToken}`;
  }, [state]);

  return (
    <QuoteContext.Provider value={{ state, dispatch, search, cancelSearch, createShareLink }}>
      {children}
    </QuoteContext.Provider>
  );
}

export function useQuote(): QuoteContextValue {
  const context = useContext(QuoteContext);
  if (!context) throw new Error("useQuote precisa estar dentro de <QuoteProvider>.");
  return context;
}

type SearchEvent =
  | { type: "start" }
  | { type: "progress"; phase: "starting" | "listing" | "collecting"; total?: number }
  | { type: "establishment"; establishment: Establishment }
  | { type: "done"; fromCache: boolean; partial: boolean }
  | { type: "error"; message: string };

function applyEvent(event: SearchEvent, dispatch: (action: QuoteAction) => void): void {
  switch (event.type) {
    case "progress":
      dispatch({ type: "search/progress", phase: event.phase, total: event.total });
      break;
    case "establishment":
      dispatch({ type: "search/result", establishment: event.establishment });
      break;
    case "done":
      dispatch({ type: "search/done", fromCache: event.fromCache, partial: event.partial });
      break;
    case "error":
      dispatch({ type: "search/error", message: event.message });
      break;
  }
}

/**
 * Lê o corpo NDJSON evento a evento.
 *
 * Um chunk da rede não respeita fronteira de linha: pode trazer meia linha, ou
 * três e meia. O resto fica no buffer até a próxima quebra.
 */
async function* readNdjson(
  body: ReadableStream<Uint8Array>,
  signal: AbortSignal,
): AsyncGenerator<SearchEvent> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (!signal.aborted) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        if (line.trim()) yield JSON.parse(line) as SearchEvent;
      }
    }

    if (buffer.trim()) yield JSON.parse(buffer) as SearchEvent;
  } finally {
    reader.cancel().catch(() => {});
  }
}
