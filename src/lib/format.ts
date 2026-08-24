import type { WhatsappConfidence } from "./places/types";

/** Formatações de exibição. Nada aqui muda dado — só como ele aparece. */

/** `+5524988181925` -> `(24) 98818-1925`. Número de fora do Brasil sai como veio. */
export function formatPhone(e164: string | null): string | null {
  if (!e164) return null;

  const digits = e164.replace(/\D/g, "");
  if (!digits.startsWith("55") || (digits.length !== 12 && digits.length !== 13)) return e164;

  const area = digits.slice(2, 4);
  const subscriber = digits.slice(4);
  const half = subscriber.length === 9 ? 5 : 4;

  return `(${area}) ${subscriber.slice(0, half)}-${subscriber.slice(half)}`;
}

/** `4.5` -> `4,5`. Nota sem valor não vira "0". */
export function formatRating(rating: number | null): string | null {
  return rating === null ? null : rating.toFixed(1).replace(".", ",");
}

export function formatReviews(count: number | null): string | null {
  return count === null ? null : count.toLocaleString("pt-BR");
}

/**
 * Como o produto fala sobre a confiança de WhatsApp.
 *
 * O texto nunca afirma: a checagem é heurística (PRD §8, risco 3) e prometer
 * WhatsApp que não existe queima a confiança logo no primeiro disparo.
 */
export function whatsappLabel(confidence: WhatsappConfidence, hasPhone: boolean): {
  text: string;
  tone: "positivo" | "neutro" | "alerta";
} {
  if (!hasPhone) return { text: "Sem telefone", tone: "alerta" };

  switch (confidence) {
    case "likely":
      return { text: "Provável WhatsApp", tone: "positivo" };
    case "unlikely":
      return { text: "Parece fixo", tone: "neutro" };
    default:
      return { text: "WhatsApp incerto", tone: "neutro" };
  }
}
