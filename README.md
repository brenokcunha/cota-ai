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

## Stack

- **Next.js 15** (App Router) + TypeScript + Tailwind
- **Postgres** (Supabase) para cache de buscas e base de estabelecimentos
- **Playwright** para coleta, em worker separado

## Rodando localmente

```bash
npm install
cp .env.example .env.local   # preencha as variáveis
npm run dev
```

Abre em http://localhost:3000.

## Estrutura

```
docs/PRD.md              Documento de produto — leia antes de mexer no escopo
src/app/                 Rotas e UI (App Router)
src/lib/places/          Busca de estabelecimentos, atrás da interface PlacesProvider
src/lib/whatsapp.ts      Template da mensagem e deep link de envio
```

A busca sempre passa por `PlacesProvider` (`src/lib/places/provider.ts`), nunca pelo
scraper direto. Trocar a fonte de dados é mudar `PLACES_PROVIDER` — não refatorar.

## Documentação

[PRD completo](docs/PRD.md) — problema, escopo do MVP, decisões técnicas, monetização e riscos.
