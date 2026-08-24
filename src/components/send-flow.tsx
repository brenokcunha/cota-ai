"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef } from "react";

import { formatPhone } from "@/lib/format";
import { selectedTargets } from "@/lib/quote/state";
import type { TargetStatus } from "@/lib/quote/types";
import { buildWhatsappLink, renderMessageFor } from "@/lib/whatsapp";

import { useQuote } from "./quote-provider";
import { ShareLink } from "./share-link";

/**
 * RF-06 — o disparo, um estabelecimento por vez.
 *
 * Cada botão abre o WhatsApp do usuário com a mensagem pronta; quem aperta
 * "enviar" é ele, sempre (PRD §6.1). Não dá para saber, do lado de cá, se o
 * envio aconteceu de fato — então marcamos ao abrir e deixamos desfazer, que
 * erra a favor de não perder o lugar na fila.
 */

const STATUS_LABEL: Record<TargetStatus, string> = {
  pending: "A enviar",
  sent: "Enviado",
  skipped: "Pulado",
};

export function SendFlow() {
  const { state, dispatch } = useQuote();
  const targets = useMemo(() => selectedTargets(state), [state]);
  const buttonRefs = useRef(new Map<string, HTMLAnchorElement | HTMLButtonElement>());

  const pending = targets.filter((t) => t.status === "pending");
  const sent = targets.filter((t) => t.status === "sent").length;
  const current = pending[0];

  /** Marca e leva o foco para o próximo pendente — o fluxo é "um clique cada". */
  const advance = useCallback(
    (placeId: string, status: TargetStatus) => {
      dispatch({ type: "send/status", placeId, status });

      const remaining = pending.filter((t) => t.establishment.placeId !== placeId);
      const next = remaining[0]?.establishment.placeId;
      if (next) {
        // Depois do re-render: antes dele o botão do próximo ainda não existe
        // na posição de "atual".
        requestAnimationFrame(() => buttonRefs.current.get(next)?.focus());
      }
    },
    [dispatch, pending],
  );

  // Ao chegar na tela, o foco vai para o primeiro pendente: quem retoma uma
  // cotação continua de onde parou sem procurar na lista (PRD §6.6).
  useEffect(() => {
    if (current) buttonRefs.current.get(current.establishment.placeId)?.focus();
    // Só na montagem: refocar a cada mudança roubaria o foco de quem navega.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (targets.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-slate-500 dark:border-slate-700">
        Nada para disparar.{" "}
        <Link href="/" className="text-emerald-700 underline dark:text-emerald-400">
          Voltar para a busca
        </Link>
        .
      </p>
    );
  }

  return (
    <div className="grid gap-5">
      <div className="grid gap-2">
        <div className="flex items-baseline justify-between gap-3">
          <p className="font-medium tabular-nums" aria-live="polite">
            {sent} de {targets.length} enviados
          </p>
          {pending.length === 0 && (
            <button
              type="button"
              onClick={() => dispatch({ type: "send/reset" })}
              className="text-sm text-slate-600 underline dark:text-slate-400"
            >
              Recomeçar
            </button>
          )}
        </div>
        <div
          className="h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800"
          role="progressbar"
          aria-valuenow={sent}
          aria-valuemin={0}
          aria-valuemax={targets.length}
        >
          <div
            className="h-full bg-emerald-600 transition-[width]"
            style={{ width: `${(sent / targets.length) * 100}%` }}
          />
        </div>
      </div>

      {pending.length === 0 && (
        <p className="rounded-xl bg-emerald-50 p-4 text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200">
          Acabou. As respostas vão chegar no seu WhatsApp.
        </p>
      )}

      <ol className="grid gap-2">
        {targets.map((target) => {
          const { establishment, status } = target;
          const isCurrent = current?.establishment.placeId === establishment.placeId;
          const message = renderMessageFor(state.template, establishment, state.variables);

          return (
            <li
              key={establishment.placeId}
              className={`flex flex-wrap items-center gap-3 rounded-xl border p-4 ${
                isCurrent
                  ? "border-emerald-500 bg-emerald-50/60 dark:bg-emerald-950/30"
                  : "border-slate-200 dark:border-slate-800"
              } ${status === "pending" ? "" : "opacity-70"}`}
            >
              <div className="min-w-0 flex-1">
                <p className="font-medium">{establishment.name}</p>
                <p className="text-sm text-slate-600 tabular-nums dark:text-slate-400">
                  {formatPhone(establishment.phoneE164)} · {STATUS_LABEL[status]}
                </p>
              </div>

              {status === "pending" ? (
                <div className="flex gap-2">
                  <a
                    ref={(node) => {
                      if (node) buttonRefs.current.set(establishment.placeId, node);
                      else buttonRefs.current.delete(establishment.placeId);
                    }}
                    href={buildWhatsappLink(establishment.phoneE164 ?? "", message)}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => advance(establishment.placeId, "sent")}
                    className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
                  >
                    Abrir WhatsApp
                  </a>
                  <button
                    type="button"
                    onClick={() => advance(establishment.placeId, "skipped")}
                    className="rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700"
                  >
                    Pular
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() =>
                    dispatch({ type: "send/status", placeId: establishment.placeId, status: "pending" })
                  }
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700"
                >
                  Desfazer
                </button>
              )}
            </li>
          );
        })}
      </ol>

      <ShareLink />

      <Link href="/mensagem" className="text-sm text-slate-600 underline dark:text-slate-400">
        Voltar para a mensagem
      </Link>
    </div>
  );
}
