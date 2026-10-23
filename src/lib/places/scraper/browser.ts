import { chromium, type Browser, type BrowserContext } from "playwright";
import type { ScraperConfig } from "./config";

/**
 * Ciclo de vida do browser headless.
 *
 * Um browser por busca: mais lento que um pool, mas não guarda estado entre
 * buscas e não vaza processo quando a coleta falha no meio. Vale rever quando
 * um worker separado existir e as buscas forem enfileiradas.
 */

/** UA de Chrome estável — o headless padrão se anuncia e é filtrado. */
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36";

/** Recursos que não precisamos: pesam na coleta e gastam banda do Google à toa. */
const BLOCKED_RESOURCES = new Set(["image", "media", "font"]);

export interface ScraperSession {
  context: BrowserContext;
  close(): Promise<void>;
}

export async function openSession(config: ScraperConfig): Promise<ScraperSession> {
  const browser: Browser = await chromium.launch({
    headless: config.headless,
    // --no-sandbox é necessário em container; --disable-dev-shm-usage evita o
    // crash do Chromium quando /dev/shm é o padrão apertado do Docker (64MB).
    args: ["--no-sandbox", "--disable-dev-shm-usage", "--disable-blink-features=AutomationControlled"],
    proxy: config.proxyUrl ? { server: config.proxyUrl } : undefined,
  });

  const context = await browser.newContext({
    locale: config.locale,
    timezoneId: config.timezone,
    userAgent: USER_AGENT,
    viewport: { width: 1280, height: 900 },
  });

  context.setDefaultTimeout(config.timeoutMs);
  context.setDefaultNavigationTimeout(config.timeoutMs);

  await context.route("**/*", (route) => {
    if (BLOCKED_RESOURCES.has(route.request().resourceType())) return route.abort();
    return route.continue();
  });

  return {
    context,
    async close() {
      await context.close().catch(() => {});
      await browser.close().catch(() => {});
    },
  };
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
