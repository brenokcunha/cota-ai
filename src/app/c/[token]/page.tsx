import { notFound } from "next/navigation";

import { QuoteRestore } from "@/components/quote-restore";
import { hasDatabase } from "@/lib/db/pool";
import { findQuote } from "@/lib/quote/repository";

/**
 * Abre uma cotação a partir do link de retomada.
 *
 * A leitura acontece no servidor: sem chamada HTTP extra, e o conteúdo já vem
 * no HTML, então o link funciona mesmo em conexão ruim.
 */

export const dynamic = "force-dynamic";

export default async function CotacaoPage({ params }: PageProps<"/c/[token]">) {
  if (!hasDatabase()) notFound();

  const { token } = await params;
  const quote = await findQuote(token);
  if (!quote) notFound();

  return <QuoteRestore quote={quote} />;
}
