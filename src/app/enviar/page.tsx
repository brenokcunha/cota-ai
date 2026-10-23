"use client";

import { useQuote } from "@/components/quote-provider";
import { SendFlow } from "@/components/send-flow";

/** Etapa 3: o disparo sequencial e o link de retomada. */
export default function EnviarPage() {
  const { state } = useQuote();

  return (
    <div className="grid gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Disparo</h1>
        <p className="mt-1 text-slate-600 dark:text-slate-400">
          Cada botão abre o WhatsApp com a mensagem pronta. Quem aperta enviar é você.
        </p>
      </div>

      {state.hydrated ? <SendFlow /> : <p className="text-slate-500">Carregando…</p>}
    </div>
  );
}
