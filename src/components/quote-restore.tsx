"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { INITIAL_STATE, type ProgressEntry } from "@/lib/quote/state";
import type { Quote } from "@/lib/quote/types";

import { useQuote } from "./quote-provider";

/**
 * Recebe a cotação do servidor e a instala no navegador de quem abriu
 * o link, como se ela tivesse sido feita ali.
 *
 * A partir daqui a cotação é local: as próximas mudanças vão para o
 * `localStorage` deste aparelho, e só voltam ao servidor se o usuário gerar o
 * link de novo.
 */
export function QuoteRestore({ quote }: { quote: Quote }) {
  const { dispatch } = useQuote();
  const router = useRouter();

  useEffect(() => {
    const progress: Record<string, ProgressEntry> = {};
    for (const target of quote.targets) {
      progress[target.establishment.placeId] = { status: target.status, at: target.sentAt };
    }

    dispatch({
      type: "restore",
      state: {
        ...INITIAL_STATE,
        category: quote.category,
        region: quote.region,
        limit: quote.targets.length,
        mode: "region",
        center: null,
        establishments: quote.targets.map((t) => t.establishment),
        // Tudo que está na cotação já foi escolhido — chegar aqui e precisar
        // remarcar um por um seria absurdo.
        selected: quote.targets.map((t) => t.establishment.placeId),
        template: quote.template,
        variables: quote.variables,
        progress,
        shareToken: quote.shareToken,
        search: {
          status: "done",
          phase: null,
          expected: null,
          error: null,
          fromCache: true,
          partial: false,
        },
      },
    });

    // `replace` e não `push`: o botão voltar deve sair da cotação, não
    // reimportá-la por cima do que o usuário fizer daqui em diante.
    router.replace("/enviar");
  }, [quote, dispatch, router]);

  return <p className="text-slate-500">Abrindo a cotação…</p>;
}
