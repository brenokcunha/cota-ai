import { randomBytes } from "node:crypto";

import { getPool, query } from "../db/pool";
import { findEstablishmentsByPlaceIds, upsertEstablishments } from "../places/repository";
import type { Quote, QuoteInput, QuoteTarget, TargetStatus } from "./types";

/**
 * Gravação e leitura da cotação anônima.
 *
 * Os estabelecimentos são gravados junto: um link de retomada aberto daqui a
 * três dias em outro aparelho precisa dos telefones, e o cache da busca pode
 * já ter vencido.
 */

/**
 * 9 bytes = 12 caracteres em base64url.
 *
 * O token é a única proteção da cotação — quem tem o link vê a lista e a
 * mensagem. Não há dado pessoal ali (LGPD), mas 72 bits de entropia
 * tornam adivinhar inviável de qualquer forma.
 */
function newShareToken(): string {
  return randomBytes(9).toString("base64url");
}

export async function saveQuote(input: QuoteInput): Promise<string> {
  const pool = getPool();
  const client = await pool.connect();

  try {
    // Tudo numa transação: uma cotação com metade dos alvos gravados seria pior
    // que nenhuma, porque o usuário confiaria no link.
    await client.query("BEGIN");

    const establishmentIds = await upsertEstablishments(
      input.targets.map((t) => t.establishment),
      client,
    );

    const token = input.shareToken || newShareToken();
    const quoteRows = await client.query<{ id: string }>(
      `INSERT INTO quotes (share_token, category, region, message_template, variables_json)
       VALUES ($1, $2, $3, $4, $5::jsonb)
       ON CONFLICT (share_token) DO UPDATE SET
         category = EXCLUDED.category,
         region = EXCLUDED.region,
         message_template = EXCLUDED.message_template,
         variables_json = EXCLUDED.variables_json,
         updated_at = now()
       RETURNING id`,
      [token, input.category, input.region, input.template, JSON.stringify(input.variables)],
    );
    const quoteId = quoteRows.rows[0].id;

    // Tirar da cotação um estabelecimento desmarcado na tela é remover a linha:
    // um `ON CONFLICT` sozinho deixaria o antigo alvo para trás.
    await client.query(
      `DELETE FROM quote_targets
        WHERE quote_id = $1
          AND establishment_id <> ALL($2::bigint[])`,
      [quoteId, input.targets.map((t) => establishmentIds.get(t.establishment.placeId) ?? 0)],
    );

    for (const [position, target] of input.targets.entries()) {
      const establishmentId = establishmentIds.get(target.establishment.placeId);
      if (!establishmentId) continue;

      await client.query(
        `INSERT INTO quote_targets (quote_id, establishment_id, position, status, sent_at)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (quote_id, establishment_id) DO UPDATE SET
           position = EXCLUDED.position,
           status = EXCLUDED.status,
           sent_at = EXCLUDED.sent_at`,
        [quoteId, establishmentId, position, target.status, target.sentAt],
      );
    }

    await client.query("COMMIT");
    return token;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

export async function findQuote(shareToken: string): Promise<Quote | null> {
  const quotes = await query<{
    id: string;
    share_token: string;
    category: string;
    region: string;
    message_template: string;
    variables_json: Record<string, string>;
  }>(
    `SELECT id, share_token, category, region, message_template, variables_json
       FROM quotes WHERE share_token = $1`,
    [shareToken],
  );

  if (quotes.length === 0) return null;
  const quote = quotes[0];

  const targetRows = await query<{
    place_id: string;
    status: TargetStatus;
    sent_at: Date | null;
  }>(
    `SELECT e.place_id, t.status, t.sent_at
       FROM quote_targets t
       JOIN establishments e ON e.id = t.establishment_id
      WHERE t.quote_id = $1
      ORDER BY t.position`,
    [quote.id],
  );

  const establishments = await findEstablishmentsByPlaceIds(targetRows.map((r) => r.place_id));
  const byPlaceId = new Map(establishments.map((e) => [e.placeId, e]));

  const targets: QuoteTarget[] = targetRows.flatMap((row) => {
    const establishment = byPlaceId.get(row.place_id);
    if (!establishment) return [];
    return [{ establishment, status: row.status, sentAt: row.sent_at?.toISOString() ?? null }];
  });

  return {
    shareToken: quote.share_token,
    category: quote.category,
    region: quote.region,
    template: quote.message_template,
    variables: quote.variables_json ?? {},
    targets,
  };
}
