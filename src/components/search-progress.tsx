"use client";

import { useQuote } from "./quote-provider";

/**
 * O que está acontecendo enquanto a busca roda.
 *
 * Uma busca nova leva dezenas de segundos e os primeiros ~7s não produzem
 * resultado nenhum — sobe o browser, abre o Google Maps, rola o feed. Sem esta
 * barra, o clique em "Buscar" parece não ter feito nada.
 *
 * A barra é indeterminada até sabermos quantas fichas existem, e determinada
 * dali em diante: só prometemos porcentagem quando ela significa alguma coisa.
 */

const PHASE_LABEL = {
  starting: "Preparando a busca…",
  listing: "Procurando no Google Maps…",
  collecting: "Lendo os telefones",
} as const;

export function SearchProgress() {
  const { state, cancelSearch } = useQuote();
  const { status, phase, expected } = state.search;

  if (status !== "running" || !phase) return null;

  const collected = state.establishments.length;
  const determinate = phase === "collecting" && expected !== null && expected > 0;
  const percent = determinate ? Math.round((collected / expected) * 100) : null;

  return (
    <section
      aria-live="polite"
      className="grid gap-2 rounded-xl border border-slate-200 p-4 dark:border-slate-800"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-sm font-medium">
          {PHASE_LABEL[phase]}
          {determinate && (
            <span className="ml-1 font-normal tabular-nums text-slate-600 dark:text-slate-400">
              — {collected} de {expected}
            </span>
          )}
        </p>
        <button
          type="button"
          onClick={cancelSearch}
          className="text-sm text-slate-600 underline dark:text-slate-400"
        >
          Cancelar
        </button>
      </div>

      <div
        className="h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800"
        role="progressbar"
        aria-valuenow={percent ?? undefined}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuetext={determinate ? `${percent}%` : PHASE_LABEL[phase]}
      >
        {determinate ? (
          <div
            className="h-full bg-emerald-600 transition-[width] duration-300"
            style={{ width: `${percent}%` }}
          />
        ) : (
          // Sem total conhecido, uma faixa que percorre a barra: indica
          // atividade sem fingir que sabe quanto falta.
          <div className="cota-scan h-full w-1/3 rounded-full bg-emerald-600" />
        )}
      </div>

      <p className="text-xs text-slate-500">
        Cada estabelecimento leva alguns segundos: a busca abre a ficha de cada um para pegar o
        telefone. Os resultados vão aparecendo aqui embaixo conforme ficam prontos.
      </p>
    </section>
  );
}
