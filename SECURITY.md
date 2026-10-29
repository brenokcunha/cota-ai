# Segurança

O cota-ai é um projeto pessoal para rodar localmente. Não há versão hospedada nem
suporte a versões antigas: vale a `main`.

## Reportando uma falha

Abra um [security advisory privado](https://github.com/brenokcunha/cota-ai/security/advisories/new)
no GitHub, em vez de uma issue pública. Descreva o que acontece e como reproduzir.

## O que o projeto assume

- Roda só em `127.0.0.1`, sem login. Expô-lo à rede deixa qualquer pessoa disparar buscas
  (cada uma sobe um Chromium e consome a reputação do seu IP no Google).
- As credenciais do `compose.yaml` são de laboratório e valem só para o Postgres local.
- O app nunca envia mensagem sozinho: só monta o link `wa.me`.
