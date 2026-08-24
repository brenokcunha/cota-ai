# PRD — cota-ai

**Versão:** 0.1 (draft inicial)
**Data:** 2026-08-24
**Autor:** Breno Cunha
**Status:** Aprovado para scaffold

---

## 1. Resumo executivo

**cota-ai** é uma ferramenta web que permite a qualquer pessoa cotar um produto ou serviço com **vários estabelecimentos de uma região ao mesmo tempo**, via WhatsApp, sem precisar abrir o Google Maps e copiar telefone por telefone.

O usuário informa **o que quer**, **onde** e **qual a pergunta**. O cota-ai lista os estabelecimentos daquele tipo na região, o usuário seleciona os que interessam, escreve (ou escolhe) uma mensagem padrão, e o sistema gera um fluxo de envio no WhatsApp do próprio usuário — um clique por estabelecimento, mensagem já preenchida.

**Frase-âncora:** _"Cotar com 15 pousadas leva 15 cliques, não 45 minutos."_

---

## 2. Problema

Hoje, para cotar algo com múltiplos estabelecimentos locais, a pessoa precisa:

1. Abrir o Google Maps e buscar a categoria na região
2. Abrir cada estabelecimento individualmente
3. Copiar o telefone
4. Abrir o WhatsApp e localizar/criar o contato
5. Digitar a mesma mensagem do zero, repetidamente
6. Repetir de 10 a 30 vezes
7. Perder o controle de quem já foi contatado e quem respondeu

É um trabalho manual, repetitivo e propenso a erro. Na prática, a maioria das pessoas desiste na terceira ou quarta consulta e decide com informação incompleta — pagando mais caro ou aceitando uma opção pior.

### 2.1 Por que os marketplaces não resolvem

Para hospedagem existem Booking e Airbnb, mas eles falham exatamente onde mais dói:

- **Cobertura incompleta:** em destinos menores, boa parte das pousadas simplesmente não está em plataforma nenhuma.
- **Êxodo em alta temporada:** em Carnaval, Réveillon e feriados prolongados, muitos estabelecimentos **retiram o anúncio da plataforma** para negociar por fora e não pagar comissão sobre a diária mais cara do ano. É justamente quando a cotação é mais valiosa.
- **Fora de turismo não existe equivalente:** floricultura, buffet, oficina, gráfica, assistência técnica — nenhum marketplace agrega cotação local desses serviços.

O WhatsApp já é o canal padrão de negociação do pequeno negócio brasileiro. O problema não é o canal — é a **falta de ferramenta para operar esse canal em escala**.

---

## 3. Público-alvo

### Persona primária — "o organizador do grupo"

Pessoa planejando uma viagem em grupo ou família para alta temporada. Tem data e número de pessoas definidos, precisa de preço e disponibilidade de várias pousadas para decidir. Alta urgência, alta disposição a usar ferramenta nova, decide rápido.

### Persona secundária — "a cotação pontual"

Pessoa que precisa de um orçamento único e local: coroa de flores, buffet de aniversário, conserto, frete. Volume menor, urgência muitas vezes maior, recorrência baixa.

### Persona terciária (fase 2) — "o estabelecimento"

Pousada, floricultura, buffet. Não é usuário do fluxo principal, mas é quem **paga** — compra posição patrocinada para aparecer no topo dos resultados da sua região.

---

## 4. Objetivos e métricas de sucesso

**Objetivo de produto:** reduzir o tempo de cotar N estabelecimentos de ~3 min/estabelecimento para menos de 15 s/estabelecimento.

**Objetivo de negócio:** construir audiência orgânica qualificada em nichos locais, monetizada por **anúncios e posição patrocinada** vendidos aos próprios estabelecimentos.

| Métrica | Definição | Meta 90 dias |
|---|---|---|
| **North Star — Mensagens disparadas** | Cliques em "enviar no WhatsApp" | 5.000/mês |
| Taxa de conclusão de busca | % de buscas que viram ≥1 disparo | > 35% |
| Estabelecimentos por sessão | Média de selecionados por cotação | ≥ 6 |
| Tempo até primeiro disparo | Da busca ao primeiro clique de envio | < 90 s |
| Retorno em 30 dias | % de usuários que fazem nova cotação | > 15% |
| Tráfego orgânico | Sessões vindas de busca | 10.000/mês |

---

## 5. Escopo do MVP

### 5.1 Dentro do escopo

O MVP é **genérico por categoria** — funciona para qualquer tipo de estabelecimento que apareça no Google Maps, não só hospedagem.

**RF-01 — Busca de estabelecimentos**
Usuário informa categoria (texto livre, ex: "pousada", "floricultura") e região (cidade/bairro, com autocomplete). Sistema retorna a lista de estabelecimentos.

**RF-02 — Resultado com dados de contato**
Cada resultado exibe: nome, endereço, nota e nº de avaliações, telefone (quando existir) e indicação de se o telefone aceita WhatsApp. Resultados sem telefone aparecem, mas marcados como não-contatáveis.

**RF-03 — Ordenação e filtro**
Ordenar por relevância, nota ou nº de avaliações. Filtrar para exibir apenas os que têm WhatsApp disponível.

**RF-04 — Seleção múltipla**
Selecionar estabelecimentos individualmente, "selecionar todos" e "selecionar todos com WhatsApp". Contador de selecionados sempre visível.

**RF-05 — Composição da mensagem**
Editor de mensagem com suporte a variáveis: `{{nome}}` (nome do estabelecimento) e campos livres definidos pelo usuário. Preview em tempo real com um estabelecimento real da lista. Templates prontos por categoria (hospedagem, evento, produto, serviço).

**RF-06 — Fluxo de disparo sequencial**
Tela de envio que percorre os selecionados um a um. Cada item tem um botão que abre `wa.me/<telefone>?text=<mensagem>` em nova aba, com a mensagem já personalizada. Ao voltar, o item é marcado como enviado e o foco vai para o próximo. Permite pular e desfazer marcação.

**RF-07 — Persistência local**
Busca, seleção, mensagem e progresso de envio sobrevivem a refresh e fechamento de aba, via `localStorage`. Sem login.

**RF-08 — Link de retomada**
Ao final, o usuário pode copiar um link que restaura a cotação (lista + mensagem + progresso) em outro dispositivo.

### 5.2 Fora do escopo do MVP

- Login e conta de usuário (fase 2)
- Envio automático sem interação do usuário (viola os Termos do WhatsApp — nunca)
- Recebimento e centralização das respostas (as respostas chegam no WhatsApp do usuário)
- Comparador automático de preços das respostas
- App nativo iOS/Android
- Painel para estabelecimento
- Pagamento/checkout
- Internacionalização (MVP é Brasil, pt-BR)

---

## 6. Decisões técnicas

### 6.1 Envio via deep link `wa.me` — decisão fundamental

O disparo **não é automatizado**. O cota-ai monta a mensagem e abre o WhatsApp do usuário; **o usuário confirma cada envio**.

Motivos:

1. **Conformidade:** automação de envio em massa viola os Termos do WhatsApp e resulta em banimento de número. Não sustenta um produto comercial.
2. **Melhor produto:** a mensagem sai do número pessoal do usuário, então a resposta chega direto no WhatsApp dele — que é onde ele quer negociar. Não precisamos construir inbox.
3. **Custo zero:** sem WhatsApp Business API, sem custo por conversa, sem verificação Meta.
4. **Taxa de resposta maior:** estabelecimento responde mais a pessoa física do que a número de plataforma.

O valor do produto está em **eliminar a busca, a coleta de telefones e a redigitação** — não em automatizar o clique de enviar.

### 6.2 Fonte de dados: scraping do Google Maps

Decisão do cliente. Coleta das listagens públicas do Google Maps via browser headless.

Implementado atrás de uma interface `PlacesProvider`, com contrato estável:

```ts
interface PlacesProvider {
  search(query: SearchQuery): Promise<Establishment[]>
}
```

Implementações previstas: `GoogleMapsScraperProvider` (MVP), `GooglePlacesApiProvider` (fallback), `OwnDatabaseProvider` (fase 3). Trocar de fonte deve custar uma linha de configuração, não uma refatoração.

### 6.3 Estratégia de cache — híbrido

- Busca nova → dispara o scraper → grava resultado no Postgres com TTL
- Busca repetida (mesma categoria + região) dentro do TTL → serve do banco, instantâneo
- TTL sugerido: **7 dias** para dados de estabelecimento, com refresh em background

Efeito colateral estratégico: a base própria — o ativo monetizável — se constrói sozinha conforme o uso, sem crawler dedicado desde o dia 1.

### 6.4 Stack

| Camada | Escolha | Motivo |
|---|---|---|
| Frontend + BFF | Next.js 15 (App Router) + TypeScript | SSR para SEO, que é pré-requisito do modelo de anúncios |
| Estilo | Tailwind CSS | Velocidade de iteração |
| Banco | Postgres (Supabase) | Relacional serve bem ao modelo; free tier suficiente no início |
| Scraper | Playwright, em worker separado | Serverless tem timeout incompatível com browser headless |
| Fila | Postgres como fila no MVP | Evita infra extra; migra para Redis/QStash quando doer |
| Hospedagem | Vercel (web) + Fly.io ou Railway (worker) | Deploy simples, escala por uso |
| Analytics | Vercel Analytics + eventos próprios | North Star exige evento customizado de disparo |

### 6.5 Modelo de dados (inicial)

```
establishments
  id, place_id, name, category, address, city, state,
  lat, lng, phone_e164, has_whatsapp, rating, reviews_count,
  source, scraped_at, updated_at

search_cache
  id, category_normalized, region_normalized,
  result_ids[], scraped_at, expires_at

quotes                    -- cotação anônima, chave em localStorage
  id, share_token, category, region, message_template,
  variables_json, created_at

quote_targets
  id, quote_id, establishment_id, status(pending|sent|skipped), sent_at

sponsorships              -- fase 2
  id, establishment_id, region, category,
  starts_at, ends_at, priority, status
```

### 6.6 Requisitos não-funcionais

- **Performance:** busca em cache < 1 s; busca nova (scraping) < 30 s com feedback de progresso
- **Mobile-first:** a maior parte do uso é no celular, onde `wa.me` abre o app nativo
- **Resiliência:** falha do scraper devolve resultado parcial + mensagem clara, nunca tela branca
- **Acessibilidade:** navegação por teclado no fluxo de envio; contraste AA
- **LGPD:** dados coletados são de estabelecimentos comerciais (pessoa jurídica, informação pública). Nenhum dado pessoal do usuário é armazenado no MVP. Política de privacidade e canal de remoção (opt-out) por estabelecimento desde o lançamento.

---

## 7. Monetização

**Modelo escolhido para o MVP: anúncios e posição patrocinada.**

- **Posição patrocinada:** estabelecimento paga para aparecer no topo dos resultados da sua categoria + região, com selo "Patrocinado" claramente visível.
- **Pré-seleção destacada:** aparece já marcado na lista (o usuário pode desmarcar).
- **Display:** espaço de anúncio na página de resultados, futuramente também via rede.

**Pré-requisito:** o modelo depende inteiramente de **volume de tráfego orgânico**. Por isso o SSR e a estratégia de SEO não são detalhes técnicos — são infraestrutura de receita. Páginas indexáveis por categoria+região (`/pousadas/paraty-rj`) são o motor de aquisição.

**Ordem de execução:** produto funcionando → tráfego → só então venda de patrocínio. Vender espaço em página sem audiência não fecha.

**Modelos descartados no MVP:** cobrança por lead (difícil de rastrear, já que a conversa acontece no WhatsApp do usuário, fora do sistema), assinatura do usuário final (mata o tráfego que sustenta os anúncios) e painel SaaS (fase 2+).

---

## 8. Riscos

| # | Risco | Impacto | Mitigação |
|---|---|---|---|
| **1** | **Scraping do Google Maps** — viola os Termos de Serviço do Google; sujeito a bloqueio de IP, CAPTCHA, mudança de layout e exposição jurídica | **Alto** | Camada `PlacesProvider` plugável desde o dia 1; rate limiting agressivo; cache para minimizar requisições; Places API pronta como fallback; monitoramento de quebra do parser |
| 2 | Google muda o HTML do Maps | Alto | Testes de contrato do parser rodando diariamente; alerta automático |
| 3 | Telefone sem WhatsApp | Médio | Verificação heurística (celular vs fixo); marcar como incerto em vez de prometer |
| 4 | Usuário abandona no meio do disparo | Médio | Progresso persistido; fluxo otimizado para 1 clique; link de retomada |
| 5 | Estabelecimento reclamar de spam | Médio | Mensagem sempre parte do usuário, nunca da plataforma; canal de opt-out; sem envio automatizado |
| 6 | Sem tráfego, sem anúncio | Alto | SEO programático desde o MVP; validar demanda em nicho antes de investir em venda |
| 7 | Google Maps lançar função equivalente | Médio | Vantagem está no fluxo de cotação em massa e nos templates por categoria, não no dado |

---

## 9. Roadmap

**Fase 0 — Fundação (concluída)**
Scaffold Next.js + TypeScript + Tailwind, repositório privado no GitHub, PRD versionado.

**Fase 1 — MVP (RF-01 a RF-08)**
Fatia vertical: busca → lista → seleção → mensagem → disparo. Deploy público.

**Fase 2 — Tração**
SEO programático por categoria+região, analytics de funil, login opcional com histórico de cotações, templates inteligentes por categoria.

**Fase 3 — Receita**
Painel de patrocínio, autocadastro de estabelecimento, base própria consolidada, métricas de entrega para o anunciante.

**Fase 4 — Expansão**
App nativo, comparação assistida de respostas, multicanal (e-mail/telefone como fallback).

---

## 10. Questões em aberto

- [ ] Domínio: `cota.ai` (TLD .ai é caro) vs `cotaai.com.br` vs alternativa — decidir antes do deploy
- [ ] Provedor de proxy para o scraper — avaliar custo real por busca
- [ ] Verificação de WhatsApp: heurística por DDD/9º dígito é suficiente ou vale checagem ativa?
- [ ] Limite de estabelecimentos por cotação — teto para evitar percepção de spam
- [ ] Estratégia de conteúdo SEO: páginas geradas por dado vs conteúdo editorial
