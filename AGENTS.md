# cota-ai

Cotação em lote pelo WhatsApp: o usuário escolhe categoria e região, o app lista
estabelecimentos (raspados do Google Maps), ele seleciona, escreve uma mensagem e envia
um a um pelo `wa.me`. O app **nunca dispara mensagem sozinho** — só monta o link; quem
confirma o envio é a pessoa. Não mude isso.

O README tem arquitetura, API, migrations e variáveis. Este arquivo cobre só o que não se
descobre lendo o código.

## Comandos

- `docker compose up --build` — sobe app (http://localhost:3000) e Postgres; migrations
  rodam sozinhas. É o caminho recomendado: o scraper precisa de Chromium.
- `docker compose restart web` — aplica mudanças de código (HMR em bind mount é pouco
  confiável).
- `npm run lint` e `npx tsc --noEmit` — checagem estática. Não há suíte de testes unitários.
- `docker compose exec web node scripts/smoke.mjs` — teste de ponta a ponta num browser
  real, com a aplicação de pé. **Bate no Google Maps de verdade**: é lento e sujeito a
  bloqueio de IP, então não rode em loop.
- `npm run migrate` — aplica `db/migrations/*.sql` pendentes. Único lugar que mexe no
  schema.

## Arquitetura: o que não pode quebrar

- A busca sempre passa por `PlacesProvider` (`src/lib/places/provider.ts`), nunca pelo
  scraper direto. Trocar de fonte é mudar `PLACES_PROVIDER`, não refatorar.
- Todo o acoplamento com o HTML do Google fica em `src/lib/places/scraper/selectors.ts`.
  Quando o Google mudar o layout, o conserto é só lá. Texto do Maps vira domínio em
  `scraper/parse.ts`, que são funções puras.
- A cotação (`src/lib/quote/state.ts`) é um objeto serializável e um reducer puro. É isso
  que a faz caber no `localStorage` e virar link de retomada. Não guarde estado da
  cotação em componente nem coloque nele algo que não serialize em JSON.
- A busca responde em NDJSON (`/api/search`): cada ficha chega assim que fica pronta. A
  tela depende de nunca mostrar tela branca — falha no meio da coleta devolve resultado
  parcial (`partial: true`).
- O WhatsApp nunca é afirmado, só indicado (`likely` / `unknown`, em `src/lib/phone.ts`).
  A checagem é heurística pelo formato do número.

## Banco e migrations

- Migrations são SQL numerado em `db/migrations/`. Crie uma nova (`008_...sql`); não
  reescreva uma que já rodou, porque não há checksum e o banco dos outros não se
  corrige sozinho.
- O app funciona sem `DATABASE_URL`: busca ao vivo, sem cache e sem link de retomada.
  Todo código que usa o banco precisa tolerar essa ausência (ver `src/lib/db/pool.ts`).
- Migrations não rodam na subida do servidor web, de propósito: rodam no entrypoint do
  container (`docker/dev-entrypoint.sh`).

## Convenções

- Idioma: comentários e textos de interface em português do Brasil. Identificadores
  misturam inglês (domínio, tipos) e português (telas, rotas); siga o arquivo em que
  estiver mexendo.
- Comentários explicam o porquê, não o quê. Decisões não óbvias (limites, ritmo do
  scraper, trade-offs) ficam documentadas no ponto do código onde importam.
- O ritmo do scraper (`SCRAPER_DELAY_MS`, `SCRAPER_MAX_RESULTS`) é conservador de
  propósito. Subir isso troca velocidade por risco de bloqueio de IP.
- Variáveis de ambiente novas entram em `.env.example`, comentadas. Nunca commite
  `.env*` (só o `.env.example` é versionado).

## Next.js 16 (App Router)

Esta versão difere do que muitos modelos conhecem. Antes de mexer em rotas, cache ou
configuração, leia o guia correspondente em `node_modules/next/dist/docs/`. Pontos que
já apareceram aqui:

- `params` é uma `Promise`: `const { token } = await params`.
- Os tipos `PageProps<"/rota">` e `RouteContext<"/rota">` são globais, sem import.

## Armadilhas conhecidas

- Os tiles do mapa vêm do OpenStreetMap público e o Nominatim limita a 1 req/s: ambos
  servem para uso pessoal, não para volume (`src/components/map-picker.tsx`,
  `NOMINATIM_URL`).
- O projeto roda só localmente, em container (`docker compose`). Não há deploy nem imagem
  de produção; não dá para rodar na Vercel (1,3 GB de Chromium, buscas de 40 s a 2 min).
- Mudou o `package-lock.json`? O container reinstala sozinho na próxima subida.
