import type { Establishment, SearchCenter } from "../places/types";
import type { QuoteTarget, TargetStatus } from "./types";

/**
 * O estado da cotação no navegador e as transições possíveis.
 *
 * É um reducer puro de propósito: a cotação inteira precisa caber num objeto
 * serializável para sobreviver a um refresh (RF-07) e para virar link de
 * retomada (RF-08). Nada de estado escondido em componente.
 */

export type SortKey = "relevancia" | "nota" | "avaliacoes";

/** Guardamos o instante do envio junto do status: o link de retomada (RF-08)
 *  mostra o que já foi disparado e quando. */
export interface ProgressEntry {
  status: TargetStatus;
  at: string | null;
}

export interface QuoteState {
  category: string;
  region: string;
  limit: number;
  /** Como o usuário disse "onde": digitando, ou desenhando no mapa. */
  mode: "region" | "map";
  /** Área escolhida no mapa. Preservada mesmo no modo texto, para voltar a ela. */
  center: SearchCenter | null;
  /** Na ordem em que a fonte devolveu — é essa a "relevância". */
  establishments: Establishment[];
  /** placeIds marcados (RF-04). */
  selected: string[];
  sort: SortKey;
  onlyWhatsapp: boolean;
  template: string;
  /** Campos livres do usuário, além do `{{nome}}` embutido (RF-05). */
  variables: Record<string, string>;
  /** Onde o disparo parou, por placeId (RF-06). */
  progress: Record<string, ProgressEntry>;
  shareToken: string | null;
  /** `false` até o `localStorage` ser lido; evita a tela piscar vazia. */
  hydrated: boolean;
  search: {
    status: "idle" | "running" | "done" | "error";
    /** Em que etapa a coleta está — alimenta a barra de progresso. */
    phase: "starting" | "listing" | "collecting" | null;
    /** Quantas fichas serão lidas. `null` enquanto não dá para saber. */
    expected: number | null;
    error: string | null;
    fromCache: boolean;
    partial: boolean;
  };
}

export const INITIAL_STATE: QuoteState = {
  category: "",
  region: "",
  limit: 20,
  mode: "region",
  center: null,
  establishments: [],
  selected: [],
  sort: "relevancia",
  onlyWhatsapp: false,
  template: "",
  variables: {},
  progress: {},
  shareToken: null,
  hydrated: false,
  search: {
    status: "idle",
    phase: null,
    expected: null,
    error: null,
    fromCache: false,
    partial: false,
  },
};

export type QuoteAction =
  | { type: "hydrate"; state: QuoteState | null }
  | { type: "restore"; state: QuoteState }
  | {
      type: "search/start";
      category: string;
      region: string;
      limit: number;
      center: SearchCenter | null;
    }
  | { type: "view/mode"; mode: "region" | "map" }
  | { type: "view/center"; center: SearchCenter }
  | { type: "search/progress"; phase: "starting" | "listing" | "collecting"; total?: number }
  | { type: "search/result"; establishment: Establishment }
  | { type: "search/done"; fromCache: boolean; partial: boolean }
  | { type: "search/error"; message: string }
  | { type: "selection/toggle"; placeId: string }
  | { type: "selection/set"; placeIds: string[] }
  | { type: "view/sort"; sort: SortKey }
  | { type: "view/onlyWhatsapp"; value: boolean }
  | { type: "message/template"; template: string }
  | { type: "message/variable"; name: string; value: string }
  | { type: "message/removeVariable"; name: string }
  | { type: "send/status"; placeId: string; status: TargetStatus }
  | { type: "send/reset" }
  | { type: "share/token"; token: string };

export function quoteReducer(state: QuoteState, action: QuoteAction): QuoteState {
  switch (action.type) {
    // Fim da leitura do localStorage. `state: null` = não havia nada salvo,
    // e mesmo assim a tela precisa saber que já pode desenhar.
    case "hydrate":
      return { ...(action.state ?? state), hydrated: true };

    case "restore":
      return { ...action.state, hydrated: true };

    case "search/start":
      // Busca nova zera seleção e progresso: manter marcações de uma lista que
      // não existe mais faria o usuário disparar para quem ele não escolheu.
      return {
        ...state,
        category: action.category,
        region: action.region,
        limit: action.limit,
        center: action.center,
        establishments: [],
        selected: [],
        progress: {},
        shareToken: null,
        search: {
          status: "running",
          // A barra já aparece aqui, antes do servidor responder qualquer
          // coisa: o silêncio dos primeiros segundos é justamente o problema.
          phase: "starting",
          expected: null,
          error: null,
          fromCache: false,
          partial: false,
        },
      };

    case "search/progress":
      return {
        ...state,
        search: {
          ...state.search,
          phase: action.phase,
          expected: action.total ?? state.search.expected,
        },
      };

    case "search/result":
      return { ...state, establishments: [...state.establishments, action.establishment] };

    case "search/done":
      return {
        ...state,
        search: {
          ...state.search,
          status: "done",
          phase: null,
          error: null,
          fromCache: action.fromCache,
          partial: action.partial,
        },
      };

    case "search/error":
      return {
        ...state,
        search: { ...state.search, status: "error", phase: null, error: action.message },
      };

    case "selection/toggle": {
      const selected = state.selected.includes(action.placeId)
        ? state.selected.filter((id) => id !== action.placeId)
        : [...state.selected, action.placeId];
      return { ...state, selected };
    }

    case "selection/set":
      return { ...state, selected: action.placeIds };

    case "view/mode":
      return { ...state, mode: action.mode };

    case "view/center":
      return { ...state, center: action.center };

    case "view/sort":
      return { ...state, sort: action.sort };

    case "view/onlyWhatsapp":
      return { ...state, onlyWhatsapp: action.value };

    case "message/template":
      return { ...state, template: action.template };

    case "message/variable":
      return { ...state, variables: { ...state.variables, [action.name]: action.value } };

    case "message/removeVariable": {
      const variables = { ...state.variables };
      delete variables[action.name];
      return { ...state, variables };
    }

    case "send/status":
      return {
        ...state,
        progress: {
          ...state.progress,
          [action.placeId]: {
            status: action.status,
            at: action.status === "pending" ? null : new Date().toISOString(),
          },
        },
      };

    case "send/reset":
      return { ...state, progress: {} };

    case "share/token":
      return { ...state, shareToken: action.token };

    default:
      return state;
  }
}

function sortEstablishments(establishments: Establishment[], sort: SortKey): Establishment[] {
  // A ordem original É a relevância que a fonte devolveu.
  if (sort === "relevancia") return establishments;

  // `slice` antes de ordenar: `sort` é destrutivo e a ordem de relevância
  // precisa continuar disponível.
  return establishments.slice().sort((a, b) => {
    const key = sort === "nota" ? "rating" : "reviewsCount";
    // Sem nota vai para o fim, não para o topo empatado com quem tem zero.
    return (b[key] ?? -1) - (a[key] ?? -1);
  });
}

/** A lista como ela aparece na tela: ordenada e filtrada (RF-03). */
export function visibleEstablishments(state: QuoteState): Establishment[] {
  const sorted = sortEstablishments(state.establishments, state.sort);
  return state.onlyWhatsapp ? sorted.filter((e) => e.whatsapp === "likely") : sorted;
}

/** Só dá para disparar para quem tem telefone (RF-02). */
export function isContactable(establishment: Establishment): boolean {
  return Boolean(establishment.phoneE164);
}

/**
 * Os selecionados, na ordem em que serão disparados.
 *
 * Usa a lista ordenada mas NÃO filtrada: ligar o filtro "só com WhatsApp"
 * depois de escolher não pode sumir com quem já estava escolhido.
 */
export function selectedTargets(state: QuoteState): QuoteTarget[] {
  const selected = new Set(state.selected);
  return sortEstablishments(state.establishments, state.sort)
    .filter((e) => selected.has(e.placeId))
    .map((establishment) => {
      const progress = state.progress[establishment.placeId];
      return {
        establishment,
        status: progress?.status ?? "pending",
        sentAt: progress?.at ?? null,
      };
    });
}
