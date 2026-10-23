"use client";

import Link from "next/link";

import { distanceKm } from "@/lib/geo";
import { isContactable, visibleEstablishments, type SortKey } from "@/lib/quote/state";

import { EstablishmentCard } from "./establishment-card";
import { useQuote } from "./quote-provider";

/**
 * A lista, seus filtros e a seleção múltipla.
 *
 * Os resultados aparecem enquanto a coleta acontece — dá para começar a
 * escolher antes de a busca terminar, que é o ponto do streaming.
 */

const SORTS: ReadonlyArray<{ key: SortKey; label: string }> = [
  { key: "relevancia", label: "Relevância" },
  { key: "nota", label: "Nota" },
  { key: "avaliacoes", label: "Nº de avaliações" },
];

export function ResultsList() {
  const { state, dispatch } = useQuote();
  const visible = visibleEstablishments(state);
  const selected = new Set(state.selected);
  const running = state.search.status === "running";

  // Distância só faz sentido quando o usuário escolheu um ponto no mapa.
  const center = state.center;
  const distanceFromCenter = (e: { lat: number | null; lng: number | null }) =>
    center && e.lat !== null && e.lng !== null
      ? distanceKm(center, { lat: e.lat, lng: e.lng })
      : null;

  if (state.search.status === "idle" && state.establishments.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-slate-500 dark:border-slate-700">
        Diga o que você quer cotar e onde. A lista aparece aqui.
      </p>
    );
  }

  if (state.search.status === "error") {
    return (
      <div
        role="alert"
        className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200"
      >
        <p className="font-medium">A busca não foi concluída.</p>
        <p className="mt-1 text-sm">{state.search.error}</p>
      </div>
    );
  }

  // Só quem tem telefone pode ser selecionado — os demais aparecem, mas o
  // "selecionar todos" não os inclui.
  const contactable = visible.filter(isContactable);
  const withWhatsapp = contactable.filter((e) => e.whatsapp === "likely");
  const allSelected = contactable.length > 0 && contactable.every((e) => selected.has(e.placeId));

  return (
    <section className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm">
          <span className="font-medium tabular-nums">
            {state.selected.length} selecionado{state.selected.length === 1 ? "" : "s"}
          </span>
          <span className="text-slate-500">de {visible.length} na lista</span>
          {running && (
            <span className="text-slate-500" aria-live="polite">
              · coletando…
            </span>
          )}
          {state.search.fromCache && <span className="text-slate-500">· resultado em cache</span>}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="size-4 accent-emerald-600"
              checked={state.onlyWhatsapp}
              onChange={(e) => dispatch({ type: "view/onlyWhatsapp", value: e.target.checked })}
            />
            Só com WhatsApp
          </label>

          <label className="flex items-center gap-2 text-sm">
            <span className="sr-only">Ordenar por</span>
            <select
              value={state.sort}
              onChange={(e) => dispatch({ type: "view/sort", sort: e.target.value as SortKey })}
              className="rounded-lg border border-slate-300 px-2 py-1 dark:border-slate-700 dark:bg-slate-900"
            >
              {SORTS.map((sort) => (
                <option key={sort.key} value={sort.key}>
                  {sort.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 text-sm">
        <button
          type="button"
          onClick={() =>
            dispatch({
              type: "selection/set",
              placeIds: allSelected ? [] : contactable.map((e) => e.placeId),
            })
          }
          className="rounded-lg border border-slate-300 px-3 py-1.5 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
        >
          {allSelected ? "Limpar seleção" : "Selecionar todos"}
        </button>

        <button
          type="button"
          onClick={() =>
            dispatch({ type: "selection/set", placeIds: withWhatsapp.map((e) => e.placeId) })
          }
          disabled={withWhatsapp.length === 0}
          className="rounded-lg border border-slate-300 px-3 py-1.5 hover:bg-slate-50 disabled:opacity-40 dark:border-slate-700 dark:hover:bg-slate-800"
        >
          Selecionar os {withWhatsapp.length} com WhatsApp
        </button>
      </div>

      {state.search.partial && (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
          Alguns estabelecimentos não puderam ser lidos. A lista está incompleta.
        </p>
      )}

      <ul className="grid gap-2">
        {visible.map((establishment) => (
          <EstablishmentCard
            key={establishment.placeId}
            establishment={establishment}
            selected={selected.has(establishment.placeId)}
            distanceKm={distanceFromCenter(establishment)}
            onToggle={() => dispatch({ type: "selection/toggle", placeId: establishment.placeId })}
          />
        ))}
      </ul>

      {!running && visible.length === 0 && (
        <p className="text-center text-slate-500">
          {state.onlyWhatsapp
            ? "Nenhum resultado com WhatsApp provável. Desligue o filtro para ver os demais."
            : "Nenhum estabelecimento encontrado para essa busca."}
        </p>
      )}

      {state.selected.length > 0 && (
        <div className="sticky bottom-4 flex justify-end">
          <Link
            href="/mensagem"
            className="rounded-full bg-emerald-600 px-6 py-3 font-medium text-white shadow-lg hover:bg-emerald-700"
          >
            Escrever mensagem ({state.selected.length})
          </Link>
        </div>
      )}
    </section>
  );
}
