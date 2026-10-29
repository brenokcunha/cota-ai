import type { Establishment, EstablishmentSource, WhatsappConfidence } from "../places/types";
import type { QuoteInput, QuoteTarget, TargetStatus } from "./types";

/**
 * Validação do corpo de `POST /api/quotes`.
 *
 * O payload vem da tela, mas "vem da tela" não é garantia de nada: qualquer um
 * pode postar aqui. Como esses campos caem direto em colunas com CHECK, validar
 * na borda é a diferença entre um 400 explicado e um 500 vindo do Postgres.
 */

const WHATSAPP: readonly WhatsappConfidence[] = ["likely", "unlikely", "unknown"];
const SOURCES: readonly EstablishmentSource[] = [
  "google-maps-scraper",
  "google-places-api",
  "own-database",
];
const STATUSES: readonly TargetStatus[] = ["pending", "sent", "skipped"];

const MAX_TARGETS = 200;
const MAX_TEMPLATE_CHARS = 4_000;

export class QuoteValidationError extends Error {}

function str(value: unknown, field: string, { max = 500 } = {}): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new QuoteValidationError(`\`${field}\` é obrigatório.`);
  }
  if (value.length > max) {
    throw new QuoteValidationError(`\`${field}\` passa de ${max} caracteres.`);
  }
  return value.trim();
}

function nullableStr(value: unknown, max = 500): string | null {
  return typeof value === "string" && value.trim() ? value.trim().slice(0, max) : null;
}

function nullableNum(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function oneOf<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return allowed.includes(value as T) ? (value as T) : fallback;
}

function parseEstablishment(raw: unknown): Establishment {
  if (typeof raw !== "object" || raw === null) {
    throw new QuoteValidationError("Alvo sem estabelecimento.");
  }
  const e = raw as Record<string, unknown>;

  return {
    placeId: str(e.placeId, "placeId"),
    name: str(e.name, "name", { max: 300 }),
    category: nullableStr(e.category, 120),
    address: nullableStr(e.address),
    neighborhood: nullableStr(e.neighborhood, 120),
    city: nullableStr(e.city, 120),
    state: nullableStr(e.state, 2),
    lat: nullableNum(e.lat),
    lng: nullableNum(e.lng),
    phoneE164: nullableStr(e.phoneE164, 20),
    whatsapp: oneOf(e.whatsapp, WHATSAPP, "unknown"),
    rating: nullableNum(e.rating),
    reviewsCount: nullableNum(e.reviewsCount),
    source: oneOf(e.source, SOURCES, "google-maps-scraper"),
    // Data ilegível vira "agora": perder a procedência é ruim, mas recusar a
    // cotação inteira por causa dela é pior.
    scrapedAt: parseDate(e.scrapedAt) ?? new Date().toISOString(),
  };
}

/** O formato que `newShareToken` gera (base64url); qualquer outra coisa é descartada. */
function parseShareToken(value: unknown): string | null {
  return typeof value === "string" && /^[A-Za-z0-9_-]{12}$/.test(value) ? value : null;
}

function parseDate(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export function parseQuoteInput(raw: unknown): QuoteInput {
  if (typeof raw !== "object" || raw === null) {
    throw new QuoteValidationError("Corpo da requisição inválido.");
  }
  const body = raw as Record<string, unknown>;

  if (!Array.isArray(body.targets) || body.targets.length === 0) {
    throw new QuoteValidationError("`targets` precisa ter ao menos um estabelecimento.");
  }
  if (body.targets.length > MAX_TARGETS) {
    throw new QuoteValidationError(`\`targets\` passa do limite de ${MAX_TARGETS}.`);
  }

  const targets: QuoteTarget[] = body.targets.map((raw) => {
    const t = raw as Record<string, unknown>;
    return {
      establishment: parseEstablishment(t.establishment),
      status: oneOf(t.status, STATUSES, "pending"),
      sentAt: parseDate(t.sentAt),
    };
  });

  // O mesmo estabelecimento duas vezes estouraria o UNIQUE de quote_targets.
  const placeIds = new Set(targets.map((t) => t.establishment.placeId));
  if (placeIds.size !== targets.length) {
    throw new QuoteValidationError("`targets` tem estabelecimentos repetidos.");
  }

  const variables: Record<string, string> = {};
  if (typeof body.variables === "object" && body.variables !== null) {
    for (const [key, value] of Object.entries(body.variables)) {
      if (typeof value === "string") variables[key.slice(0, 60)] = value.slice(0, 500);
    }
  }

  return {
    shareToken: parseShareToken(body.shareToken),
    category: str(body.category, "category", { max: 120 }),
    region: str(body.region, "region", { max: 200 }),
    template: typeof body.template === "string" ? body.template.slice(0, MAX_TEMPLATE_CHARS) : "",
    variables,
    targets,
  };
}
