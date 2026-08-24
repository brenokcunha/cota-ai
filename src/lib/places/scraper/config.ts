/**
 * Leitura das variáveis de ambiente do scraper, em um lugar só.
 *
 * Os defaults são deliberadamente comedidos: o risco #1 do PRD é justamente
 * o scraping, e um scraper agressivo é o jeito mais rápido de tomar bloqueio
 * de IP. Quem quiser ir mais rápido muda a variável e assume o risco.
 */

export interface ScraperConfig {
  headless: boolean;
  /** Timeout de cada navegação/espera, em ms. */
  timeoutMs: number;
  /** Pausa entre visitas a fichas. É o rate limiting do PRD §8, risco 1. */
  delayMs: number;
  /**
   * Teto absoluto de resultados por busca.
   *
   * É uma válvula de segurança contra um pedido absurdo, não o número que a
   * tela oferece: deixá-lo abaixo do que a UI permite escolher faz o servidor
   * devolver menos do que foi pedido, sem dizer por quê.
   */
  maxResults: number;
  /** Proxy opcional (`http://user:pass@host:porta`). Ver PRD §10. */
  proxyUrl: string | null;
  locale: string;
  timezone: string;
  /** Salva screenshot + HTML em `debugDir` quando uma ficha falha. */
  debugDir: string | null;
}

function num(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const value = Number(raw);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

export function getScraperConfig(): ScraperConfig {
  return {
    headless: process.env.SCRAPER_HEADLESS !== "false",
    timeoutMs: num("SCRAPER_TIMEOUT_MS", 30_000),
    delayMs: num("SCRAPER_DELAY_MS", 1_200),
    maxResults: num("SCRAPER_MAX_RESULTS", 60),
    proxyUrl: process.env.SCRAPER_PROXY_URL || null,
    locale: process.env.SCRAPER_LOCALE || "pt-BR",
    timezone: process.env.SCRAPER_TIMEZONE || "America/Sao_Paulo",
    debugDir: process.env.SCRAPER_DEBUG_DIR || null,
  };
}
