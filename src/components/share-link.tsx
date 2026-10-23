"use client";

import { useState } from "react";

import { useQuote } from "./quote-provider";

/**
 * Link que restaura a cotação em outro aparelho.
 *
 * O link só é criado quando o usuário pede: enquanto ele não pedir, a cotação
 * não sai do navegador dele, o que é o comportamento mais previsível para
 * quem não fez login nenhum.
 */

export function ShareLink() {
  const { state, createShareLink } = useQuote();
  const [url, setUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function generate() {
    setBusy(true);
    setError(null);
    try {
      const link = await createShareLink();
      setUrl(link);
      await copy(link);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível gerar o link.");
    } finally {
      setBusy(false);
    }
  }

  async function copy(value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2_000);
    } catch {
      // Sem permissão de área de transferência o link continua visível na tela
      // para o usuário copiar à mão.
    }
  }

  return (
    <section className="grid gap-2 rounded-xl border border-slate-200 p-4 dark:border-slate-800">
      <h2 className="font-medium">Continuar em outro aparelho</h2>
      <p className="text-sm text-slate-600 dark:text-slate-400">
        Gera um link com a lista, a mensagem e o que já foi enviado. Quem abrir o link vê a cotação —
        não compartilhe com quem não deve ver.
      </p>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => void generate()}
          disabled={busy}
          className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium disabled:opacity-50 dark:border-slate-700"
        >
          {busy ? "Gerando…" : url ? "Atualizar link" : "Gerar link"}
        </button>

        {url && (
          <button
            type="button"
            onClick={() => void copy(url)}
            className="text-sm text-emerald-700 underline dark:text-emerald-400"
          >
            {copied ? "Copiado!" : "Copiar de novo"}
          </button>
        )}
      </div>

      {url && (
        <input
          readOnly
          value={url}
          onFocus={(event) => event.currentTarget.select()}
          aria-label="Link de retomada"
          className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-xs dark:border-slate-800 dark:bg-slate-900"
        />
      )}

      {state.shareToken && !url && (
        <p className="text-sm text-slate-500">
          Esta cotação já tem um link. Gere de novo para incluir o progresso atual.
        </p>
      )}

      {error && (
        <p role="alert" className="text-sm text-amber-700 dark:text-amber-400">
          {error}
        </p>
      )}
    </section>
  );
}
