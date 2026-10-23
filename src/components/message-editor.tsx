"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { selectedTargets } from "@/lib/quote/state";
import { TEMPLATES, extractVariables } from "@/lib/quote/templates";
import { renderMessageFor } from "@/lib/whatsapp";

import { useQuote } from "./quote-provider";

/**
 * A mensagem e suas variáveis.
 *
 * Os campos livres não são cadastrados numa tela à parte: escrever `{{data}}`
 * no texto já cria o campo. Assim a variável e o lugar onde ela aparece são a
 * mesma coisa, e não há como sobrar campo que ninguém usa.
 */

export function MessageEditor() {
  const { state, dispatch } = useQuote();
  const [previewIndex, setPreviewIndex] = useState(0);

  const targets = useMemo(() => selectedTargets(state), [state]);

  // `nome` é preenchido pelo sistema com o nome de cada estabelecimento, então
  // não vira campo para o usuário responder.
  const customVariables = useMemo(
    () => extractVariables(state.template).filter((name) => name !== "nome"),
    [state.template],
  );

  const previewTarget = targets[Math.min(previewIndex, Math.max(targets.length - 1, 0))];
  const preview = previewTarget
    ? renderMessageFor(state.template, previewTarget.establishment, state.variables)
    : "";

  const missing = customVariables.filter((name) => !state.variables[name]?.trim());
  const ready = state.template.trim().length > 0 && targets.length > 0;

  if (targets.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-slate-500 dark:border-slate-700">
        Nenhum estabelecimento selecionado.{" "}
        <Link href="/" className="text-emerald-700 underline dark:text-emerald-400">
          Voltar para a busca
        </Link>
        .
      </p>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="grid content-start gap-4">
        <div>
          <h2 className="text-sm font-medium">Comece de um modelo</h2>
          <div className="mt-2 flex flex-wrap gap-2">
            {TEMPLATES.map((template) => (
              <button
                key={template.id}
                type="button"
                onClick={() => dispatch({ type: "message/template", template: template.body })}
                title={template.hint}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
              >
                {template.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-1">
          <label htmlFor="mensagem" className="text-sm font-medium">
            Mensagem
          </label>
          <textarea
            id="mensagem"
            rows={10}
            value={state.template}
            onChange={(e) => dispatch({ type: "message/template", template: e.target.value })}
            placeholder="Olá, {{nome}}! Tudo bem?"
            className="rounded-lg border border-slate-300 px-3 py-2 font-mono text-sm dark:border-slate-700 dark:bg-slate-900"
          />
          <p className="text-xs text-slate-500">
            <code>{"{{nome}}"}</code> vira o nome do estabelecimento. Qualquer outra coisa entre{" "}
            <code>{"{{ }}"}</code> vira um campo aqui embaixo.
          </p>
        </div>

        {customVariables.length > 0 && (
          <fieldset className="grid gap-3">
            <legend className="text-sm font-medium">Seus campos</legend>
            {customVariables.map((name) => (
              <div key={name} className="grid gap-1">
                <label htmlFor={`var-${name}`} className="text-sm text-slate-600 dark:text-slate-400">
                  {name}
                </label>
                <input
                  id={`var-${name}`}
                  value={state.variables[name] ?? ""}
                  onChange={(e) =>
                    dispatch({ type: "message/variable", name, value: e.target.value })
                  }
                  className="rounded-lg border border-slate-300 px-3 py-2 dark:border-slate-700 dark:bg-slate-900"
                />
              </div>
            ))}
          </fieldset>
        )}
      </div>

      <div className="grid content-start gap-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-medium">Como vai chegar</h2>
          <label className="text-sm">
            <span className="sr-only">Pré-visualizar com</span>
            <select
              value={previewIndex}
              onChange={(e) => setPreviewIndex(Number(e.target.value))}
              className="max-w-56 rounded-lg border border-slate-300 px-2 py-1 dark:border-slate-700 dark:bg-slate-900"
            >
              {targets.map((target, index) => (
                <option key={target.establishment.placeId} value={index}>
                  {target.establishment.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        {/* Fundo de conversa para o usuário julgar a mensagem como ela vai
            aparecer no aparelho de quem recebe, não como texto num formulário. */}
        <div className="rounded-xl bg-slate-100 p-4 dark:bg-slate-900">
          <p className="ml-auto max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-sm bg-emerald-100 px-4 py-3 text-sm dark:bg-emerald-900/50">
            {preview || (
              <span className="text-slate-500">Escreva a mensagem para ver a prévia.</span>
            )}
          </p>
        </div>

        {missing.length > 0 && (
          <p className="text-sm text-amber-700 dark:text-amber-400">
            Sem preencher {missing.map((name) => `"${name}"`).join(", ")}, o campo some da mensagem.
          </p>
        )}

        <div className="flex items-center justify-between gap-3">
          <Link href="/" className="text-sm text-slate-600 underline dark:text-slate-400">
            Voltar para a lista
          </Link>
          <Link
            href="/enviar"
            aria-disabled={!ready}
            onClick={(event) => {
              if (!ready) event.preventDefault();
            }}
            className={`rounded-full px-6 py-3 font-medium text-white ${
              ready ? "bg-emerald-600 hover:bg-emerald-700" : "pointer-events-none bg-slate-400"
            }`}
          >
            Disparar para {targets.length}
          </Link>
        </div>
      </div>
    </div>
  );
}
