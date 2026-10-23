"use client";

import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from "react";

import { CATEGORY_GROUPS, CUSTOM_CATEGORY, isCustomCategory } from "@/lib/categories";
import type { SearchCenter } from "@/lib/places/types";

import { MapPicker } from "./map-picker";
import { useQuote } from "./quote-provider";

/**
 * A busca na tela: o que você quer e onde.
 *
 * "Onde" tem dois caminhos, e os dois ficam visíveis ao mesmo tempo: um rádio
 * diz qual vale para a busca. Escondê-los atrás de abas obrigava a decidir
 * antes de ver — e o mapa é justamente o que ajuda a decidir.
 *
 * Digitar a região move o mapa até ela. Assim o mapa já começa perto do que
 * interessa em vez de no meio do Brasil, e escolher um raio ali vira um clique
 * em vez de uma navegação.
 *
 * O limite fica visível porque cada resultado custa alguns segundos de coleta —
 * esconder isso faria a espera parecer travamento.
 */

const LIMITS = [10, 20, 30, 40] as const;

interface Focus {
  lat: number;
  lng: number;
  label: string;
}

export function SearchForm() {
  const { state, dispatch, search, cancelSearch } = useQuote();
  const [category, setCategory] = useState(state.category);
  const [region, setRegion] = useState(state.region);
  const [limit, setLimit] = useState<number>(state.limit);
  const [regionSuggestions, setRegionSuggestions] = useState<string[]>([]);
  const [focus, setFocus] = useState<Focus | null>(null);
  const [locating, setLocating] = useState(false);
  // Uma categoria fora da lista só pode ter vindo do campo livre — é assim que
  // uma cotação retomada volta com o campo aberto, e não com a lista errada.
  const [freeText, setFreeText] = useState(() => isCustomCategory(state.category));

  const running = state.search.status === "running";
  const byMap = state.mode === "map";

  // Autocomplete de região. O atraso evita uma consulta por tecla, e o
  // `AbortController` impede que uma resposta lenta sobrescreva uma recente.
  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      // Menos de duas letras sugeriria a base inteira. A limpeza mora aqui
      // dentro, e não no corpo do efeito, para não disparar render em cascata.
      if (region.trim().length < 2) {
        setRegionSuggestions([]);
        return;
      }

      try {
        const response = await fetch(`/api/regions?q=${encodeURIComponent(region.trim())}`, {
          signal: controller.signal,
        });
        const body = (await response.json()) as { regions?: string[] };
        setRegionSuggestions(body.regions ?? []);
      } catch {
        // Sugestão é conveniência: falhar aqui não pode atrapalhar quem digita.
      }
    }, 250);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [region]);

  // Localiza a região para o mapa. Espera bem mais que o autocomplete: isto
  // chama um serviço externo limitado a uma requisição por segundo, então só
  // dispara quando a digitação realmente parou.
  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      if (region.trim().length < 3) {
        setLocating(false);
        setFocus(null);
        return;
      }

      setLocating(true);
      try {
        const response = await fetch(`/api/geocode?q=${encodeURIComponent(region.trim())}`, {
          signal: controller.signal,
        });
        const body = (await response.json()) as { result?: Focus | null };
        setFocus(body.result ?? null);
      } catch {
        // Mapa parado é um incômodo, não um erro que precise aparecer na tela.
      } finally {
        setLocating(false);
      }
    }, 700);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [region]);

  const setCenter = useCallback(
    (center: SearchCenter) => {
      dispatch({ type: "view/center", center });
      // Mexer no mapa é dizer que a busca é por ali: obrigar a marcar o rádio
      // depois de já ter escolhido a área seria uma etapa a mais sem motivo.
      dispatch({ type: "view/mode", mode: "map" });
    },
    [dispatch],
  );

  const ready = Boolean(category.trim() && (byMap ? state.center : region.trim()));

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!ready) return;

    void search({
      category: category.trim(),
      // No modo mapa o rótulo sai do servidor, a partir do ponto e do raio.
      region: byMap ? "" : region.trim(),
      limit,
      center: byMap ? state.center : null,
    });
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-4">
      <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
        <div className="grid gap-1">
          <label htmlFor="categoria" className="text-sm font-medium">
            O que você procura
          </label>

          {/* Lista primeiro, texto livre no fim: os termos da lista são os que
              o Google Maps responde bem, e digitar errado devolve lista vazia
              sem explicar o motivo. */}
          <select
            id="categoria"
            value={freeText ? CUSTOM_CATEGORY : category}
            onChange={(e) => {
              const chosen = e.target.value;
              if (chosen === CUSTOM_CATEGORY) {
                setFreeText(true);
                setCategory("");
              } else {
                setFreeText(false);
                setCategory(chosen);
              }
            }}
            className="rounded-lg border border-slate-300 px-3 py-2 dark:border-slate-700 dark:bg-slate-900"
          >
            <option value="" disabled>
              Escolha uma categoria…
            </option>
            {CATEGORY_GROUPS.map((group) => (
              <optgroup key={group.label} label={group.label}>
                {group.options.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </optgroup>
            ))}
            <option value={CUSTOM_CATEGORY}>Outra (digitar)…</option>
          </select>

          {freeText && (
            <input
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="marmoraria, tapeçaria, gráfica rápida…"
              autoComplete="off"
              aria-label="Categoria personalizada"
              autoFocus
              className="rounded-lg border border-slate-300 px-3 py-2 dark:border-slate-700 dark:bg-slate-900"
            />
          )}
        </div>

        <div className="grid gap-1">
          <label htmlFor="limite" className="text-sm font-medium">
            Até quantos
          </label>
          <select
            id="limite"
            value={limit}
            onChange={(e) => setLimit(Number(e.target.value))}
            className="rounded-lg border border-slate-300 px-3 py-2 dark:border-slate-700 dark:bg-slate-900"
          >
            {LIMITS.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </div>
      </div>

      <fieldset className="grid gap-3">
        <legend className="mb-1 text-sm font-medium">Onde buscar</legend>

        <ModeBlock
          id="modo-regiao"
          checked={!byMap}
          onSelect={() => dispatch({ type: "view/mode", mode: "region" })}
          title="Pela região"
          hint="cidade, bairro ou distrito"
        >
          <input
            id="regiao"
            value={region}
            onChange={(e) => {
              setRegion(e.target.value);
              // Digitar é escolher: quem está escrevendo a região não quer que
              // a busca saia por um ponto marcado no mapa antes.
              dispatch({ type: "view/mode", mode: "region" });
            }}
            placeholder="Paraty RJ, Caraíva Porto Seguro…"
            list="regioes-sugeridas"
            autoComplete="off"
            aria-label="Cidade ou bairro"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 dark:border-slate-700 dark:bg-slate-900"
          />
          {/* `datalist` sugere sem prender: o campo continua aceitando
              qualquer texto, que é o que a região precisa. */}
          <datalist id="regioes-sugeridas">
            {regionSuggestions.map((suggestion) => (
              <option key={suggestion} value={suggestion} />
            ))}
          </datalist>

          <p className="mt-1 text-xs text-slate-500">
            {locating
              ? "Localizando no mapa…"
              : focus
                ? "Marcado no mapa abaixo."
                : "O mapa abaixo acompanha o que você digitar."}
          </p>
        </ModeBlock>

        <ModeBlock
          id="modo-mapa"
          checked={byMap}
          onSelect={() => dispatch({ type: "view/mode", mode: "map" })}
          title="Por um ponto no mapa"
          hint="para a área que não tem nome"
        >
          <MapPicker value={state.center} focus={focus} onChange={setCenter} />
        </ModeBlock>
      </fieldset>

      <div className="flex justify-end">
        {running ? (
          <button
            type="button"
            onClick={cancelSearch}
            className="rounded-lg border border-slate-300 px-5 py-2 font-medium dark:border-slate-700"
          >
            Parar
          </button>
        ) : (
          <button
            type="submit"
            disabled={!ready}
            className="rounded-lg bg-emerald-600 px-6 py-2 font-medium text-white hover:bg-emerald-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 disabled:opacity-40"
          >
            Buscar
          </button>
        )}
      </div>
    </form>
  );
}

/**
 * Um dos dois jeitos de dizer "onde", com o rádio que o escolhe.
 *
 * O bloco não selecionado continua utilizável: mexer nele é o que o seleciona.
 * Desabilitar obrigaria a marcar o rádio antes de poder experimentar, que é o
 * mesmo atrito que as abas causavam.
 */
function ModeBlock({
  id,
  checked,
  onSelect,
  title,
  hint,
  children,
}: {
  id: string;
  checked: boolean;
  onSelect(): void;
  title: string;
  hint: string;
  children: ReactNode;
}) {
  return (
    <div
      className={`rounded-xl border p-3 transition ${
        checked
          ? "border-emerald-500 bg-emerald-50/40 dark:bg-emerald-950/20"
          : "border-slate-200 dark:border-slate-800"
      }`}
    >
      <label htmlFor={id} className="flex cursor-pointer flex-wrap items-baseline gap-x-2">
        <input
          type="radio"
          id={id}
          name="modo-busca"
          checked={checked}
          onChange={onSelect}
          className="size-4 accent-emerald-600"
        />
        <span className="text-sm font-medium">{title}</span>
        <span className="text-xs text-slate-500">{hint}</span>
      </label>

      <div className="mt-2">{children}</div>
    </div>
  );
}
