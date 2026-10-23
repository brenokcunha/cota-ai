"use client";

import { MessageEditor } from "@/components/message-editor";
import { useQuote } from "@/components/quote-provider";

/** Etapa 2: escrever a mensagem. */
export default function MensagemPage() {
  const { state } = useQuote();

  return (
    <div className="grid gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">A mensagem</h1>
        <p className="mt-1 text-slate-600 dark:text-slate-400">
          Uma mensagem só, personalizada para cada estabelecimento.
        </p>
      </div>

      {state.hydrated ? <MessageEditor /> : <p className="text-slate-500">Carregando…</p>}
    </div>
  );
}
