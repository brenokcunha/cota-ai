# Retomada

Onde o projeto parou e o que fazer a seguir. Última atualização: **25/08/2026**.

Para o produto, leia o [PRD](PRD.md). Para rodar e entender a arquitetura, o
[README](../README.md). Este arquivo é só o ponto de retomada.

---

## Estado em 25/08/2026

O **MVP está completo e verificado**: as oito RFs do PRD §5.1 funcionam de ponta a ponta,
com dados reais do Google Maps.

| | |
| --- | --- |
| Repositório | `brenokcunha/cota-ai` (privado) |
| `main` | PR #1 mergeado — RF-01 a RF-08 |
| **Pendente** | **PR #2 — deploy (fly.toml, imagem de produção, migrations)** |
| Verificação | `scripts/smoke.mjs`, 43 verificações, todas passando |
| Em produção | **Ainda não subiu** |

### Atenção ao retomar

O PR #1 foi mergeado **antes** do commit de deploy. Então o `main` tem o produto, mas
**não tem** `fly.toml`, o alvo `runner` do Dockerfile nem `scripts/migrate.mjs`. Isso
está no PR #2. Merge esse PR antes de tentar qualquer deploy.

---

## Próximo passo: subir em produção

Decidido: **container único no Fly.io**, região `gru` (São Paulo).

```bash
fly launch --no-deploy --copy-config
fly postgres create --region gru
fly secrets set DATABASE_URL="postgres://…"
fly deploy
```

O `fly.toml` versionado já traz região, memória, swap, limite de concorrência e o
`release_command` que aplica as migrations antes da nova versão receber tráfego.

### Duas decisões que ficaram com você

1. **Custo.** Uma máquina de 2 GB sempre ligada mais o Postgres gerenciado têm custo
   mensal, que não cotei porque os preços mudam. Confira antes do `fly deploy`.
2. **Máquina sempre ligada.** `min_machines_running = 1` no `fly.toml`. Com
   scale-to-zero você economiza, mas a primeira busca do dia paga o boot de uma imagem
   de 2,5 GB. Achei o custo pior que a economia na fase de validação — é uma linha se
   discordar.

---

## Por que Fly, e não Vercel

**A Vercel não serve para este app.** Não é configuração, são dois limites duros:

| | O app precisa | A Vercel dá |
| --- | --- | --- |
| Tamanho | 1,3 GB de Chromium | 250 MB por função |
| Duração | 40s a 2min por busca | 60s (300s no Pro) |

O PRD §6.4 já previa e desenha um **worker separado** — que ainda não existe. Até ele
existir, o app inteiro roda num container só.

**Entre Fly, Railway e Render**, só o Fly tem região no Brasil. Isso pesa duas vezes:
latência para o usuário, e — o que decide — um IP brasileiro raspando o Google Maps
brasileiro. De um datacenter americano o Google tende a servir muro de consentimento e
resultados enviesados, que é o risco #1 do PRD. Railway e Render seriam mais simples de
operar se esse fator não existisse.

---

## O que ficou de fora do MVP

Em ordem do que eu faria primeiro:

1. **Worker separado do scraper** (PRD §6.4). Hoje a coleta roda no processo do Next.
   Correto em container, impeditivo em serverless. É o que destrava a Vercel e o que
   permite enfileirar buscas em vez de segurar a requisição.
2. **Testes de contrato do parser** (PRD §8, risco 2). As funções puras de
   `src/lib/places/scraper/parse.ts` foram escritas separadas justamente para isso.
   Quando o Google mudar o layout, é o que avisa antes do usuário.
3. **Provedores próprios de tiles e geocodificação.** Hoje usa os serviços públicos do
   OpenStreetMap, cujas políticas de uso **não cobrem tráfego de produto**. Ambos estão
   a uma variável de ambiente de distância (`NOMINATIM_URL`, e uma linha em
   `src/components/map-picker.tsx`).
4. **SEO programático** (PRD fase 2). É pré-requisito do modelo de anúncios, e o risco
   #6 do PRD é justamente "sem tráfego, sem anúncio".

---

## Decisões tomadas, e por quê

Estão comentadas no código, mas as que mais surpreendem:

- **O envio nunca é automatizado.** O app monta a mensagem e abre o WhatsApp; quem
  aperta enviar é o usuário. É o que mantém o produto dentro dos Termos e faz a resposta
  chegar direto nele (PRD §6.1). Não mexa nisso sem reler a seção.
- **`whatsapp` é texto de três estados, não booleano.** O PRD §6.5 dizia `has_whatsapp`,
  mas o próprio PRD manda "marcar como incerto em vez de prometer" — e booleano não sabe
  dizer "não sei".
- **Bairro sai do endereço coletado, não do IBGE.** O IBGE não publica lista de bairros:
  tem municípios, distritos e 646 subdistritos que não incluem Moema nem Ipanema.
- **Distritos do IBGE entram no autocomplete.** Caraíva e Trancoso são distritos de
  Porto Seguro; sem eles a busca por nome não acha e sobra navegar o mapa.
- **O autocomplete ordena por população, não alfabeticamente.** Por nome, digitar "rio"
  nunca chegaria em Rio de Janeiro.
- **A lista de categorias não usa as categorias que o scraper coletou.** O Google
  *reporta* "Hotel 2 estrelas" na ficha, mas quem *busca* por isso acha menos que quem
  busca "pousada". São vocabulários diferentes.
- **`limite` é teto, não cota.** Quem decide quantos resultados existem é o Google.

---

## Armadilhas conhecidas

Coisas que custaram depuração e vão morder de novo:

- **Hot reload não funciona bem no Docker em Windows.** Depois de mexer no código,
  `docker compose restart web`. Já perdi um ciclo de teste com código velho rodando.
- **`outputFileTracingIncludes` no `next.config.ts` é obrigatório.** O rastreamento do
  build standalone segue `import`, e o Playwright lê `browsers.json` em runtime. Sem
  isso, a imagem de produção **sobe normalmente** e só quebra na primeira busca.
- **A tag da imagem do Playwright tem que acompanhar a versão do pacote.** Divergiram, o
  código procura um browser que não está na imagem.
- **`.gitattributes` força LF.** `docker/dev-entrypoint.sh` com CRLF quebra o `sh` do
  container com um erro que não menciona quebra de linha.
- **Quando o Google mudar o layout**, o conserto é em
  `src/lib/places/scraper/selectors.ts`. É o único arquivo que conhece o HTML deles.

---

## Retomando o ambiente local

```bash
WEB_PORT=3001 docker compose up --build      # 3000 costuma estar ocupada
docker compose exec web node scripts/smoke.mjs
```

O smoke test dirige a aplicação num browser real e confere as oito RFs. Se ele passar,
o ambiente está de pé. Screenshots de cada passo ficam em `.smoke/`.
