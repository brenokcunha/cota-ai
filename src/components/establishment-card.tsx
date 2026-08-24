"use client";

import { formatPhone, formatRating, formatReviews, whatsappLabel } from "@/lib/format";
import type { Establishment } from "@/lib/places/types";

/**
 * RF-02 — um resultado da busca.
 *
 * Estabelecimento sem telefone continua aparecendo, marcado como não
 * contatável: escondê-lo faria a lista parecer menor do que a realidade, e o
 * usuário reclamaria de "faltou a pousada X".
 */

const TONE_CLASSES = {
  positivo: "bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200",
  neutro: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  alerta: "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200",
} as const;

interface Props {
  establishment: Establishment;
  selected: boolean;
  /** Distância até o centro da busca. Só existe quando se buscou por raio. */
  distanceKm?: number | null;
  onToggle(): void;
}

export function EstablishmentCard({ establishment, selected, distanceKm, onToggle }: Props) {
  const contactable = Boolean(establishment.phoneE164);
  const badge = whatsappLabel(establishment.whatsapp, contactable);
  const rating = formatRating(establishment.rating);
  const reviews = formatReviews(establishment.reviewsCount);

  return (
    <li>
      {/* O rótulo inteiro é a área de clique: no celular, acertar só a caixinha
          de seleção é irritante. */}
      <label
        className={`flex cursor-pointer gap-3 rounded-xl border p-4 transition ${
          selected
            ? "border-emerald-500 bg-emerald-50/60 dark:bg-emerald-950/30"
            : "border-slate-200 hover:border-slate-300 dark:border-slate-800 dark:hover:border-slate-700"
        } ${contactable ? "" : "opacity-70"}`}
      >
        <input
          type="checkbox"
          className="mt-1 size-5 shrink-0 accent-emerald-600"
          checked={selected}
          onChange={onToggle}
          disabled={!contactable}
          aria-describedby={`${establishment.placeId}-contato`}
        />

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-2">
            <span className="font-medium">{establishment.name}</span>
            {establishment.category && (
              <span className="text-sm text-slate-500 dark:text-slate-400">
                {establishment.category}
              </span>
            )}
          </div>

          {establishment.address && (
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{establishment.address}</p>
          )}

          <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
            <span
              id={`${establishment.placeId}-contato`}
              className={`rounded-full px-2 py-0.5 text-xs font-medium ${TONE_CLASSES[badge.tone]}`}
            >
              {badge.text}
            </span>

            {contactable && (
              <span className="tabular-nums text-slate-700 dark:text-slate-300">
                {formatPhone(establishment.phoneE164)}
              </span>
            )}

            {typeof distanceKm === "number" && (
              <span className="tabular-nums text-slate-600 dark:text-slate-400">
                a {distanceKm.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} km
              </span>
            )}

            {rating && (
              <span className="text-slate-600 dark:text-slate-400">
                <span aria-hidden="true">★</span> {rating}
                {reviews && <span className="text-slate-500"> ({reviews})</span>}
                <span className="sr-only">
                  nota {rating} de 5{reviews ? `, ${reviews} avaliações` : ""}
                </span>
              </span>
            )}
          </div>
        </div>
      </label>
    </li>
  );
}
