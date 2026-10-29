/**
 * Smoke test do fluxo inteiro.
 *
 * Dirige a aplicação de verdade num browser de verdade — é o que garante que
 * as oito RFs funcionam juntas, e não só cada uma no seu canto. Enquanto o
 * projeto não tiver suíte de testes, é isto que roda antes de uma entrega.
 *
 *   docker compose exec web node scripts/smoke.mjs
 *
 * Sai com código 1 se alguma verificação falhar. Screenshots ficam em `.smoke/`.
 */

import { mkdir } from "node:fs/promises";
import { chromium } from "playwright";

const BASE = process.env.SMOKE_BASE_URL ?? "http://localhost:3000";
const SHOTS = ".smoke";

const CATEGORIA = "floricultura";
const REGIAO = "Moema Sao Paulo";

/** Centro de Moema, para a busca por raio. */
const CENTRO = { lat: -23.604, lng: -46.6578, raio: 2 };

let step = 0;
const failures = [];

function check(label, condition, detail = "") {
  const ok = Boolean(condition);
  console.log(`${ok ? "  ok  " : " FALHA"} ${label}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures.push(label);
  return ok;
}

function secao(titulo) {
  console.log("");
  console.log(titulo);
}

async function shot(page, name) {
  step += 1;
  await page.screenshot({
    path: `${SHOTS}/${String(step).padStart(2, "0")}-${name}.png`,
    fullPage: true,
  });
}

/** Haversine, para conferir o raio sem confiar no código que está sendo testado. */
function distKm(a, b) {
  const R = 6371;
  const rad = (d) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

await mkdir(SHOTS, { recursive: true });

const browser = await chromium.launch({ args: ["--no-sandbox", "--disable-dev-shm-usage"] });
const context = await browser.newContext({ locale: "pt-BR", viewport: { width: 900, height: 1000 } });
const page = await context.newPage();
page.setDefaultTimeout(90_000);

try {
  // ---- busca -------------------------------------------------------
  secao("Busca");
  await page.goto(BASE);
  await page.getByLabel("O que você procura").selectOption(CATEGORIA);
  await page.getByLabel("Cidade ou bairro").fill(REGIAO);
  await page.getByLabel("Até quantos").selectOption("10");
  await page.getByRole("button", { name: "Buscar" }).click();

  await page.getByText(/de \d+ na lista/).waitFor();
  await page.waitForFunction(() => !document.body.textContent?.includes("coletando…"));

  const cards = page.locator("main ul li");
  const total = await cards.count();
  check("a busca devolveu resultados", total > 0, `${total} encontrados`);
  check("respeita o teto pedido", total <= 10, `${total} <= 10`);
  await shot(page, "busca");

  // ---- categorias --------------------------------------------------
  secao("Lista de categorias");
  const grupos = await page.locator("#categoria optgroup").count();
  const opcoes = await page.locator("#categoria option").count();
  check("a categoria virou lista agrupada", grupos >= 5, `${grupos} grupos, ${opcoes} opções`);

  const temLivre = await page.locator("#categoria option", { hasText: "Outra (digitar)" }).count();
  check("a última opção libera texto livre", temLivre === 1);

  await page.getByLabel("O que você procura").selectOption({ label: "Outra (digitar)…" });
  const campoLivre = page.getByLabel("Categoria personalizada");
  await campoLivre.waitFor();
  check("escolher \"Outra\" mostra o campo de texto", await campoLivre.isVisible());
  await campoLivre.fill("marmoraria");
  check("o campo livre aceita qualquer termo", (await campoLivre.inputValue()) === "marmoraria");

  await page.getByLabel("O que você procura").selectOption(CATEGORIA);
  check("voltar para a lista esconde o campo livre", (await campoLivre.count()) === 0);

  // ---- feedback de progresso ---------------------------------------
  secao("Feedback de progresso");
  const eventos = await page.evaluate(async (url) => {
    const response = await fetch(url, { headers: { accept: "application/x-ndjson" } });
    const texto = await response.text();
    return texto
      .trim()
      .split(/\r?\n/)
      .map((linha) => JSON.parse(linha));
  }, `/api/search?categoria=${encodeURIComponent(CATEGORIA)}&regiao=${encodeURIComponent(REGIAO)}&limite=10`);

  const iProgresso = eventos.findIndex((e) => e.type === "progress");
  const iPrimeiro = eventos.findIndex((e) => e.type === "establishment");
  const comTotal = eventos.find((e) => e.type === "progress" && typeof e.total === "number");

  check("a busca emite eventos de progresso", iProgresso >= 0);
  check(
    "o progresso chega antes do primeiro resultado",
    iProgresso >= 0 && (iPrimeiro === -1 || iProgresso < iPrimeiro),
  );
  check(
    "o progresso informa quantas fichas serão lidas",
    Boolean(comTotal),
    `total=${comTotal?.total}`,
  );

  // ---- autocomplete de região --------------------------------------
  secao("Autocomplete de região (base própria + IBGE)");
  const sugestoes = await page.evaluate(async () => {
    const r = await fetch("/api/regions?q=mo");
    return (await r.json()).regions;
  });

  check("sugere bairro conhecido antes de cidade", sugestoes[0]?.startsWith("Moema"), sugestoes[0]);
  // Município sai como "Nome UF"; distrito, como "Nome, Município UF".
  check(
    "sugere municípios do IBGE",
    sugestoes.some((s) => /^[^,]+ [A-Z]{2}$/.test(s) && !s.startsWith("Moema")),
    `${sugestoes.length} sugestões: ${sugestoes.slice(0, 4).join(" | ")}`,
  );

  const semBanco = await page.evaluate(async () => {
    const r = await fetch("/api/regions?q=x");
    return (await r.json()).regions;
  });
  check("prefixo curto demais não sugere nada", semBanco.length === 0);

  // O caso que motivou incluir distritos: Caraíva não é município, é distrito
  // de Porto Seguro, e antes disso só dava para chegar lá navegando o mapa.
  const distritos = await page.evaluate(async () => {
    const r = await fetch("/api/regions?q=carai");
    return (await r.json()).regions;
  });
  check(
    "acha distrito pelo nome (Caraíva)",
    distritos.some((s) => /Cara[ií]va, Porto Seguro BA/.test(s)),
    distritos[0],
  );

  const semRepetir = new Set(
    distritos.map((s) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase()),
  );
  check("não repete a mesma região com e sem acento", semRepetir.size === distritos.length);

  // ---- mapa acompanha a região digitada ----------------------------
  secao("O mapa segue a região digitada");
  const local = await page.evaluate(async () => {
    const r = await fetch("/api/geocode?q=" + encodeURIComponent("Caraíva, Porto Seguro BA"));
    return (await r.json()).result;
  });
  check("localiza a região no mapa", local !== null, local && `${local.lat}, ${local.lng}`);
  check(
    "a coordenada cai na Bahia",
    local && local.lat < -15 && local.lat > -19 && local.lng < -38 && local.lng > -41,
  );

  const inexistente = await page.evaluate(async () => {
    const r = await fetch("/api/geocode?q=zzqxwv+lugar+nenhum");
    return (await r.json()).result;
  });
  check("região sem coordenada devolve null, não erro", inexistente === null);

  // ---- busca por ponto e raio --------------------------------------
  secao("Busca por ponto e raio");
  const porRaio = await page.evaluate(async (c) => {
    const r = await fetch(
      `/api/search?categoria=floricultura&lat=${c.lat}&lng=${c.lng}&raio=${c.raio}&limite=6`,
    );
    return r.json();
  }, CENTRO);

  check(
    "a busca por raio devolve resultados",
    porRaio.establishments?.length > 0,
    `${porRaio.establishments?.length} encontrados`,
  );
  check("o centro volta na resposta", porRaio.query?.center?.radiusKm === CENTRO.raio);

  const fora = porRaio.establishments.filter(
    (e) => e.lat !== null && e.lng !== null && distKm(CENTRO, e) > CENTRO.raio,
  );
  check("nenhum resultado cai fora do raio", fora.length === 0, `${fora.length} fora`);

  const raioInvalido = await page.evaluate(async () => {
    const r = await fetch("/api/search?categoria=x&lat=999&lng=0");
    return r.status;
  });
  check("coordenada inválida é recusada", raioInvalido === 400, `HTTP ${raioInvalido}`);

  // Os dois modos convivem na tela; o radio diz qual vale.
  const radioRegiao = page.getByLabel("Pela região");
  const radioMapa = page.getByLabel("Por um ponto no mapa");
  check("os dois modos ficam visíveis juntos", await radioRegiao.isVisible());
  check("o campo de região continua visível com o mapa", await page.getByLabel("Cidade ou bairro").isVisible());

  await page.locator(".leaflet-container").waitFor();
  await page.waitForTimeout(2_500);
  const tiles = await page.locator(".leaflet-tile").count();
  check("o mapa carrega com tiles", tiles > 0, `${tiles} tiles`);
  check("digitar a região deixa o modo em \"pela região\"", await radioRegiao.isChecked());

  await radioMapa.check();
  check("o rádio troca o modo", await radioMapa.isChecked());
  await radioRegiao.check();
  await shot(page, "mapa");

  // ---- dados de contato -------------------------------------------
  secao("Dados de contato");
  const texto = await cards.first().innerText();
  check("mostra telefone formatado", /\(\d{2}\)\s?\d{4,5}-\d{4}/.test(texto));
  check("mostra nota e avaliações", /★\s?\d,\d/.test(texto));
  check(
    "classifica o WhatsApp sem prometer",
    /Provável WhatsApp|Parece fixo|WhatsApp incerto|Sem telefone/.test(texto),
  );

  // ---- ordenação e filtro -----------------------------------------
  secao("Ordenação e filtro");
  const nomesRelevancia = await cards.locator("span.font-medium").allInnerTexts();
  await page.getByLabel("Ordenar por").selectOption("nota");
  const nomesNota = await cards.locator("span.font-medium").allInnerTexts();
  check("ordenar por nota muda a lista", nomesRelevancia.join() !== nomesNota.join());

  await page.getByLabel("Só com WhatsApp").check();
  const filtrados = await cards.count();
  check("filtro de WhatsApp reduz a lista", filtrados <= total, `${filtrados} de ${total}`);
  await page.getByLabel("Só com WhatsApp").uncheck();
  await page.getByLabel("Ordenar por").selectOption("relevancia");
  await shot(page, "ordenacao-filtro");

  // ---- seleção múltipla -------------------------------------------
  secao("Seleção múltipla");
  await page.getByRole("button", { name: "Selecionar todos" }).click();
  const contador = page.getByText(/\d+ selecionados?/);
  const selecionados = Number((await contador.innerText()).match(/\d+/)[0]);
  check("selecionar todos marca a lista", selecionados > 0, `${selecionados} marcados`);

  await page.getByRole("button", { name: /Selecionar os \d+ com WhatsApp/ }).click();
  const comWhatsapp = Number((await contador.innerText()).match(/\d+/)[0]);
  check("selecionar só os com WhatsApp reduz a seleção", comWhatsapp <= selecionados, `${comWhatsapp}`);

  await page.getByRole("button", { name: "Selecionar todos" }).click();
  await shot(page, "selecao");

  // ---- persistência ------------------------------------------------
  secao("Persistência local");
  await page.reload();
  await page.getByText(/de \d+ na lista/).waitFor();
  const depoisDoReload = Number((await contador.innerText()).match(/\d+/)[0]);
  check("seleção sobrevive ao refresh", depoisDoReload > 0, `${depoisDoReload} ainda marcados`);

  // ---- composição da mensagem -------------------------------------
  secao("Composição da mensagem");
  await page.getByRole("link", { name: /Escrever mensagem/ }).click();
  await page.getByRole("button", { name: "Produto" }).click();

  await page.getByLabel("produto", { exact: true }).fill("100 rosas vermelhas");
  await page.getByLabel("quantidade", { exact: true }).fill("100 unidades");

  const previaTexto = await page.locator("main p.whitespace-pre-wrap").innerText();
  check("a prévia troca {{nome}} pelo estabelecimento real", !previaTexto.includes("{{nome}}"));
  check("a prévia aplica os campos livres", previaTexto.includes("100 rosas vermelhas"));
  await shot(page, "mensagem");

  // ---- disparo sequencial -----------------------------------------
  secao("Disparo sequencial");
  await page.getByRole("link", { name: /Disparar para \d+/ }).click();
  await page.getByRole("progressbar").waitFor();

  const primeiroBotao = page.getByRole("link", { name: "Abrir WhatsApp" }).first();
  const href = await primeiroBotao.getAttribute("href");
  check("o botão aponta para wa.me", href?.startsWith("https://wa.me/"), href?.slice(0, 40));
  check("a mensagem vai pré-preenchida no link", href?.includes("?text="));
  check(
    "o link carrega a mensagem personalizada",
    decodeURIComponent(href.split("?text=")[1]).includes("100 rosas vermelhas"),
  );
  await shot(page, "disparo");

  const [popup] = await Promise.all([context.waitForEvent("page"), primeiroBotao.click()]);
  await popup.close();

  await page.getByText(/1 de \d+ enviados/).waitFor();
  check("marca como enviado após abrir o WhatsApp", true);

  await page.getByRole("button", { name: "Pular" }).first().click();
  check("permite pular", await page.getByText("Pulado").first().isVisible());

  await page.getByRole("button", { name: "Desfazer" }).first().click();
  check("permite desfazer", await page.getByText(/0 de \d+ enviados/).isVisible());

  const [popup2] = await Promise.all([
    context.waitForEvent("page"),
    page.getByRole("link", { name: "Abrir WhatsApp" }).first().click(),
  ]);
  await popup2.close();
  await shot(page, "disparo-progresso");

  // ---- link de retomada -------------------------------------------
  secao("Link de retomada");
  await page.getByRole("button", { name: "Gerar link" }).click();
  const campoLink = page.getByLabel("Link de retomada");
  await campoLink.waitFor();
  const link = await campoLink.inputValue();
  check("gerou um link de retomada", /\/c\/[\w-]{8,}$/.test(link), link);

  // Outro contexto = outro aparelho: localStorage vazio, só o link.
  const outroAparelho = await browser.newContext({
    locale: "pt-BR",
    viewport: { width: 900, height: 1000 },
  });
  const outraPagina = await outroAparelho.newPage();
  outraPagina.setDefaultTimeout(60_000);
  await outraPagina.goto(link);
  await outraPagina.waitForURL("**/enviar");
  await outraPagina.getByRole("progressbar").waitFor();

  const progressoRestaurado = await outraPagina.getByText(/\d+ de \d+ enviados/).innerText();
  check("a cotação abre em outro aparelho", true, progressoRestaurado);
  check("o progresso veio junto", !progressoRestaurado.startsWith("0 de"), progressoRestaurado);

  const mensagemRestaurada = await outraPagina
    .getByRole("link", { name: "Abrir WhatsApp" })
    .first()
    .getAttribute("href");
  check(
    "a mensagem veio junto",
    decodeURIComponent(mensagemRestaurada.split("?text=")[1]).includes("100 rosas vermelhas"),
  );
  await shot(outraPagina, "retomada-outro-aparelho");
  await outroAparelho.close();
} catch (error) {
  console.error("");
  console.error("Erro durante o smoke test:", error.message);
  await shot(page, "erro").catch(() => {});
  failures.push(`exceção: ${error.message}`);
} finally {
  await browser.close();
}

console.log("");
console.log(
  failures.length === 0
    ? `Tudo passou. Screenshots em ${SHOTS}/`
    : `${failures.length} verificação(ões) falharam:\n - ${failures.join("\n - ")}`,
);
process.exit(failures.length === 0 ? 0 : 1);
