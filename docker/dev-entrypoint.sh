#!/bin/sh
set -e

# node_modules vive num volume nomeado, para que os binarios de Linux nao se
# misturem com os do host. O efeito colateral e que o volume sobrevive a um
# `docker compose build`: mexer no package.json e subir de novo deixaria o
# container com as dependencias velhas, e o erro que aparece ("Cannot find
# module") nao diz nada sobre o volume.
#
# Entao reinstalamos quando, e so quando, o lock mudou desde a ultima instalacao.
STAMP="node_modules/.installed-from-lock"

if [ ! -f "$STAMP" ] || ! cmp -s package-lock.json "$STAMP"; then
  echo "[entrypoint] package-lock.json mudou — rodando npm ci"
  PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 npm ci
  cp package-lock.json "$STAMP"
fi

# Schema antes do servidor, o mesmo caminho que o deploy usa. Sem banco
# configurado o app sobe assim mesmo, so sem cache e sem link de retomada.
if [ -n "$DATABASE_URL" ]; then
  node scripts/migrate.mjs
fi

exec "$@"
