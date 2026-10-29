# cota-ai

Cote com vários estabelecimentos de uma região ao mesmo tempo, pelo WhatsApp.

Você informa **o que quer**, **onde** e **qual a pergunta**. O cota-ai lista os
estabelecimentos daquele tipo na região, você seleciona os que interessam, escreve uma
mensagem padrão, e envia para todos — um clique cada, mensagem já preenchida, do seu
próprio WhatsApp.

> Cotar com 15 pousadas leva 15 cliques, não 45 minutos.

## Por que existe

Booking e Airbnb resolvem descoberta e reserva, mas em destinos menores boa parte das
pousadas não está em plataforma nenhuma — e em Carnaval e Réveillon muitas **saem** da
plataforma para negociar direto e não pagar comissão. Fora de turismo (floricultura,
buffet, oficina) não existe equivalente nenhum. A negociação acontece no WhatsApp; o que
falta é ferramenta para operar esse canal em escala.

## Como funciona o envio

O cota-ai **não dispara mensagens sozinho**. Ele monta a mensagem personalizada e abre o
WhatsApp com ela pronta — você confirma cada envio. Isso mantém o produto dentro dos
Termos do WhatsApp e faz as respostas chegarem direto no seu WhatsApp, onde você quer
negociar.

## Segurança

Projeto de uso pessoal, feito para rodar **só na sua máquina**. Não tem autenticação,
HTTPS nem hardening de produção, e as credenciais do `compose.yaml` (`cotaai:cotaai`)
são de laboratório. Não o publique em servidor aberto à internet sem antes resolver isso.
Para reportar uma falha, veja [SECURITY.md](SECURITY.md).

## Stack

- **Next.js 15** (App Router) + TypeScript + Tailwind
- **Postgres** (Supabase) para cache de buscas e base de estabelecimentos
- **Playwright** para coleta, em worker separado

## Rodando localmente

O caminho recomendado é Docker: o scraper precisa de Chromium e de um punhado de
bibliotecas de sistema, e a imagem oficial do Playwright já traz tudo. O compose sobe
a aplicação e um Postgres, e as migrations rodam sozinhas na subida.

```bash
docker compose up --build
```

Abre em http://localhost:3000. A porta fica presa a `127.0.0.1`: o app não tem login e
cada busca sobe um Chromium, então ele não deve ser exposto à rede.

Se a porta já estiver ocupada por outro projeto:

```bash
WEB_PORT=3001 DB_PORT=55433 docker compose up --build
```

Variáveis opcionais (proxy, ritmo do scraper) vão em um `.env.local` na raiz — veja
`.env.example`. O compose carrega o arquivo se ele existir.

> **Hot reload:** o Next avisa que HMR através de bind mount do Docker é lento e pouco
> confiável no Windows e no Mac, e é isso mesmo que acontece aqui. Depois de mexer no
> código, rode `docker compose restart web` (~10s). Quem quiser HMR de verdade roda
> `npm run dev` no host e instala o browser com `npx playwright install chromium` — só
> lembre de apontar `DATABASE_URL` para `localhost:55432`.

Mudou o `package.json`? Não precisa fazer nada: o container detecta o lock novo e
reinstala sozinho na próxima subida.

> **Mapa:** os tiles vêm do OpenStreetMap, sem chave de API e sem cadastro de cobrança.
> A política de uso dos tiles públicos do OSM cobre uso pessoal, mas não volume: se o
> uso crescer, troque por um provedor de tiles em `src/components/map-picker.tsx`.

### Verificando que está tudo de pé

```bash
docker compose exec web node scripts/smoke.mjs
```

Dirige a aplicação num browser de verdade e confere o fluxo de ponta a ponta —
busca, filtro, seleção, mensagem, disparo, persistência e link de retomada. Screenshots
de cada passo ficam em `.smoke/`.

## O fluxo

| Tela | O que faz |
| --- | --- |
| `/` | Busca por região (com autocomplete) ou por ponto e raio no mapa — os dois visíveis juntos, um rádio escolhe qual vale. Barra de progresso, lista com telefone e nota, ordenação, filtro de WhatsApp, seleção múltipla |
| `/mensagem` | Modelos por categoria, variáveis e prévia com um estabelecimento real |
| `/enviar` | Disparo um a um pelo `wa.me`, com pular/desfazer, e o link de retomada |
| `/c/[token]` | Abre uma cotação salva em outro aparelho |

A cotação inteira vive no `localStorage` e só vai para o banco quando o usuário
pede o link de retomada.

## API

### `GET /api/search`

Duas formas de dizer onde procurar. Por texto:

```bash
curl "http://localhost:3000/api/search?categoria=pousada&regiao=Paraty%20RJ&limite=5"
```

Ou por ponto e raio, para a região que não tem nome:

```bash
curl "http://localhost:3000/api/search?categoria=floricultura&lat=-23.6040&lng=-46.6578&raio=2"
```

| Parâmetro | Obrigatório | Descrição |
| --- | --- | --- |
| `categoria` | sim | Texto livre: `pousada`, `floricultura` |
| `regiao` | sim, se não houver `lat`/`lng` | Cidade ou bairro: `Paraty RJ`, `Moema SP` |
| `lat`, `lng` | sim, se não houver `regiao` | Centro da busca |
| `raio` | não | Km a partir do centro; 0,5 a 50, padrão 5 |
| `limite` | não | **Teto**, não cota: 1 a 60, cortado por `SCRAPER_MAX_RESULTS` |

`limite` é um teto. O Google decide quantos resultados existem e em que ritmo os
entrega, então pedir 20 pode devolver 18 numa região pequena. O que **não** pode
acontecer é devolver um número fixo independente da busca — se isso voltar, o suspeito
é a rolagem do feed em `collectPlaceUrls`.

A busca por raio não usa API paga: a URL do Google Maps aceita `@lat,lng,zoom`, o zoom
aproxima a área, e o recorte exato sai de um filtro por distância. Como os links do
feed já trazem a coordenada de cada lugar, o filtro roda **antes** de abrir as fichas —
não se gasta coleta com quem vai ser descartado.

Responde JSON por padrão. Com `Accept: application/x-ndjson`, devolve um evento por
linha conforme a coleta acontece:

| Evento | Quando | Para quê |
| --- | --- | --- |
| `start` | imediatamente | a tela sai do estado "conectando" |
| `progress` | a cada fase (`starting`, `listing`, `collecting`) | alimenta a barra; `collecting` traz o total |
| `establishment` | a cada ficha lida | o resultado aparece antes de a busca acabar |
| `done` / `error` | no fim | fecha o stream |

Os primeiros ~7 segundos de uma busca nova não produzem resultado nenhum — sobe o
browser, abre o Google, rola o feed. É para isso que existem os eventos de progresso.

Busca nova custa ~3s por estabelecimento, porque visita a ficha de cada um: é lá que
mora o telefone. Repetir a mesma busca dentro do TTL sai do cache, instantânea. Uma
ficha que falha não derruba a busca — o resultado volta com `partial: true`.

Erros: `400` (parâmetros inválidos), `429` (CAPTCHA — use proxy ou aumente
`SCRAPER_DELAY_MS`), `502` (o layout do Maps mudou).

### Categorias

A tela oferece uma lista agrupada (87 opções em 8 grupos) com texto livre no fim, em
`src/lib/categories.ts`. Ela vem da taxonomia oficial do Google Places — os 507
`place types` — mas reescrita como o termo que funciona na **busca** do Maps em
português (`oficina mecânica`, não `car_repair`) e filtrada pelo que faz sentido cotar:
a taxonomia tem 117 subtipos de restaurante, além de aeroporto e arquipélago.

As categorias que o scraper já coletou **não** entram como sugestão. O Google reporta
`Hotel 2 estrelas` na ficha, mas quem busca por isso acha menos que quem busca
`pousada` — o vocabulário que se reporta e o que se pesquisa são diferentes.

### `GET /api/regions?q=`

Sugestões de região, de três fontes com vagas próprias (3 + 3 + 3):

1. **Bairros e cidades da nossa base** — extraídos do endereço dos estabelecimentos já
   coletados. São, por construção, regiões que a busca sabe resolver, e vêm primeiro
   porque bairro é a granularidade que mais serve para cotar.
2. **Municípios do IBGE** (5.571).
3. **Distritos do IBGE** (5.108) — Caraíva, Trancoso, Arraial D'Ajuda. Muito destino
   turístico não é município, e sem distritos a busca por nome simplesmente não acha.

As vagas são divididas em vez de disputadas: numa lista única, digitar "cara" encheria
tudo de Caraá, Caraguatatuba e Carambeí antes de chegar em Caraíva.

Dentro de cada fonte a ordem é por **população**, não alfabética. Ordenado por nome,
"rio" traria Rio Acima, Rio Azul e Rio Bananal — e nunca Rio de Janeiro. A ordem já vem
gravada no arquivo, então a consulta é uma varredura simples.

> O IBGE **não publica lista de bairros**. A API de localidades tem municípios,
> distritos e apenas 646 subdistritos — sem Moema, Ipanema ou Pinheiros. Por isso o
> bairro sai do endereço que o scraper já coleta, e a lista cresce com o uso.

Para atualizar (municípios, distritos e população): `node scripts/build-ibge-regions.mjs`.

### `GET /api/geocode?q=`

Onde fica a região digitada, para o mapa se posicionar nela **antes** da busca. Não
define a área da busca: quem faz isso é o clique no mapa.

Usa o Nominatim (o geocodificador do OpenStreetMap), coerente com os tiles do mapa. Duas
regras da política de uso deles moldaram o código:

- **Máx. 1 requisição/segundo** — há uma fila com espaçamento mínimo no servidor.
- **Proibido usar em autocomplete** — a tela só geocodifica depois que a digitação
  para (700 ms), nunca a cada tecla.

O resultado é cacheado no Postgres **para sempre**: a coordenada de Caraíva não muda, e
assim o serviço externo é chamado uma vez por região distinta. Para volume de produto,
`NOMINATIM_URL` aponta para uma instância própria ou comercial sem tocar em mais nada.

### `POST /api/quotes` e `GET /api/quotes/{token}`

Gravam e leem a cotação anônima. Mandar `shareToken` no `POST` atualiza a existente, que
é como o progresso do disparo acompanha o link.

## Estrutura

```
db/migrations/                         Schema em SQL, aplicado na subida do servidor
scripts/smoke.mjs                      Teste de ponta a ponta do fluxo inteiro      
scripts/build-ibge-regions.mjs         Regera a lista de municipios do IBGE

src/app/                               Telas e rotas (App Router)
src/components/quote-provider.tsx      Estado da cotação + leitura do streaming
src/components/map-picker.tsx          Mapa (Leaflet + OpenStreetMap) para ponto e raio
src/lib/categories.ts                  Lista de categorias da busca
src/lib/geo.ts                         Distância entre pontos e zoom equivalente ao raio
src/lib/regions/ibge.ts                Municípios e distritos do IBGE para o autocomplete
src/lib/regions/geocode.ts             Região -> coordenada (Nominatim + cache no Postgres)
src/lib/quote/state.ts                 Reducer puro: a cotação inteira num objeto
src/lib/quote/repository.ts            Cotação anônima no Postgres
src/lib/places/provider.ts             Interface PlacesProvider e resolução por env
src/lib/places/cached-provider.ts      Cache com TTL por cima da fonte
src/lib/places/google-maps-scraper.ts  Coleta via Playwright
src/lib/places/scraper/selectors.ts    TODO o acoplamento com o HTML do Google
src/lib/places/scraper/parse.ts        Texto do Maps -> domínio (funções puras)
src/lib/phone.ts                       E.164 e heurística de WhatsApp
src/lib/whatsapp.ts                    Template da mensagem e deep link de envio
```

Três lugares valem a atenção de quem for mexer:

- A busca sempre passa por `PlacesProvider`, nunca pelo scraper direto. Trocar a fonte
  de dados é mudar `PLACES_PROVIDER` — não refatorar.
- Quando o Google mudar o layout, o conserto é em `scraper/selectors.ts`. É o único
  arquivo que conhece o HTML deles.
- A cotação é um objeto serializável só. É isso que faz ela caber no `localStorage` e
  virar link de retomada sem código extra.

## Migrations

```bash
npm run migrate      # ou: node scripts/migrate.mjs
```

O entrypoint do container roda isso antes do `next dev`. Não rodam na subida do
servidor web: é um caminho só, e o schema não muda por baixo de quem está usando.

O cota-ai roda só localmente, via `docker compose`. Não há deploy nem imagem de produção.

## Licença

[MIT](LICENSE)
