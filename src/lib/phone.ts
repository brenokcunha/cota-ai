import type { WhatsappConfidence } from "./places/types";

/**
 * Normalização de telefone brasileiro e heurística de WhatsApp.
 *
 * A heurística é deliberadamente conservadora: quando não dá para afirmar,
 * devolvemos "unknown" em vez de "likely". O produto indica, nunca promete,
 * que o número atende no WhatsApp.
 */

const BR_COUNTRY_CODE = "55";

/**
 * DDDs válidos no Brasil. Números com DDD fora desta lista são quase sempre
 * erro de parse (ex: pegamos um CEP ou um horário no lugar do telefone).
 */
const VALID_AREA_CODES = new Set([
  11, 12, 13, 14, 15, 16, 17, 18, 19,
  21, 22, 24, 27, 28,
  31, 32, 33, 34, 35, 37, 38,
  41, 42, 43, 44, 45, 46, 47, 48, 49,
  51, 53, 54, 55,
  61, 62, 63, 64, 65, 66, 67, 68, 69,
  71, 73, 74, 75, 77, 79,
  81, 82, 83, 84, 85, 86, 87, 88, 89,
  91, 92, 93, 94, 95, 96, 97, 98, 99,
]);

/**
 * Converte um telefone brasileiro escrito de qualquer jeito para E.164.
 *
 * Aceita "(24) 99999-8888", "+55 24 3371-1234", "024 3371 1234".
 * Devolve null para número sem DDD, DDD inválido ou lixo — melhor perder um
 * contato do que montar um link de WhatsApp que abre no número errado.
 */
export function toE164(raw: string | null | undefined): string | null {
  if (!raw) return null;

  let digits = raw.replace(/\D/g, "");
  if (!digits) return null;

  // Prefixo internacional escrito como "00 55 ..."
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.startsWith(BR_COUNTRY_CODE) && (digits.length === 12 || digits.length === 13)) {
    digits = digits.slice(2);
  }
  // "0" de operadora antes do DDD: 024 3371 1234
  if (digits.length === 11 && digits.startsWith("0")) digits = digits.slice(1);
  if (digits.length === 12 && digits.startsWith("0")) digits = digits.slice(1);

  // Sobrou DDD + 8 (fixo) ou DDD + 9 (celular). Qualquer outro tamanho é lixo.
  if (digits.length !== 10 && digits.length !== 11) return null;

  const areaCode = Number(digits.slice(0, 2));
  if (!VALID_AREA_CODES.has(areaCode)) return null;

  const subscriber = digits.slice(2);
  // Nenhum número brasileiro válido começa com 0 ou 1 depois do DDD.
  if (/^[01]/.test(subscriber)) return null;

  return `+${BR_COUNTRY_CODE}${digits}`;
}

/**
 * Adivinha se o número atende no WhatsApp pelo formato.
 *
 * Celular no Brasil tem 9 dígitos e começa com 9; fixo tem 8 e começa com 2-5.
 * Isso erra em dois sentidos — fixo com WhatsApp Business existe, e celular
 * sem WhatsApp também — por isso "likely"/"unlikely" e nunca um booleano.
 * Checagem ativa contra o WhatsApp fica para depois.
 */
export function guessWhatsapp(e164: string | null): WhatsappConfidence {
  if (!e164) return "unknown";

  const digits = e164.replace(/\D/g, "");
  if (!digits.startsWith(BR_COUNTRY_CODE)) return "unknown";

  const subscriber = digits.slice(4); // tira 55 + DDD
  if (subscriber.length === 9 && subscriber.startsWith("9")) return "likely";
  if (subscriber.length === 8 && /^[2-5]/.test(subscriber)) return "unlikely";
  return "unknown";
}
