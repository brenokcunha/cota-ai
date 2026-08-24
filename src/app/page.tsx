"use client";

import { ResultsList } from "@/components/results-list";
import { SearchForm } from "@/components/search-form";
import { SearchProgress } from "@/components/search-progress";
import { useQuote } from "@/components/quote-provider";

/** Etapa 1: achar os estabelecimentos (RF-01 a RF-04). */
export default function BuscaPage() {
  const { state } = useQuote();

  return (
    <div className="grid gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Cote com todo mundo de uma vez</h1>
        <p className="mt-1 text-slate-600 dark:text-slate-400">
          Ache os estabelecimentos, escolha quem interessa e mande a mesma mensagem para todos — do
          seu WhatsApp, um clique cada.
        </p>
      </div>

      <SearchForm />

      <SearchProgress />

      {/* Antes de ler o localStorage não dá para saber se há uma cotação em
          andamento; mostrar a lista vazia aqui faria a tela piscar. */}
      {state.hydrated ? <ResultsList /> : <p className="text-slate-500">Carregando…</p>}
    </div>
  );
}
