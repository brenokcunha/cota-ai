# Imagem oficial do Playwright: já traz o Chromium e as bibliotecas de sistema
# que ele precisa, que é a parte chata de instalar à mão.
#
# A tag TEM QUE acompanhar a versão de `playwright` no package.json. Versões
# diferentes fazem o Playwright procurar um browser que não está na imagem.
FROM mcr.microsoft.com/playwright:v1.62.1-noble AS deps

WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

COPY package.json package-lock.json ./
# Os browsers já vêm na imagem (em /ms-playwright); baixar de novo só engorda.
RUN PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 npm ci

# Alvo de desenvolvimento: o compose monta o código por cima deste COPY, que
# existe para a imagem também rodar sozinha, sem bind mount.
FROM deps AS dev
COPY . .
EXPOSE 3000
# `sh` explicito: o bit de execucao nao sobrevive a um checkout no Windows.
ENTRYPOINT ["sh", "/app/docker/dev-entrypoint.sh"]
CMD ["npm", "run", "dev"]

# ---- produção ---------------------------------------------------------------

FROM deps AS build
COPY . .
# O build não fala com o banco; a URL existe só porque o Next avalia o módulo
# de configuração, e um valor de fachada evita ramificar o código por causa
# disso.
ENV DATABASE_URL=postgres://build:build@localhost:5432/build
RUN npm run build

FROM mcr.microsoft.com/playwright:v1.62.1-noble AS runner

WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
# `next start` escuta em localhost por padrão, e nada de fora do container
# alcançaria isso.
ENV HOSTNAME=0.0.0.0
ENV PORT=3000

# O standalone traz o server.js e só as dependências que o servidor usa;
# `static` e `public` ficam de fora dele e são copiados à parte.
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public

# As migrations e o runner delas não entram no bundle do Next: são arquivos
# lidos do disco, e o deploy os executa antes de subir a aplicação.
#
# `pg` e `playwright` não precisam ser copiados: o standalone já os inclui, por
# estarem em `serverExternalPackages` e serem importados pelo servidor.
COPY --from=build /app/db ./db
COPY --from=build /app/scripts/migrate.mjs ./scripts/migrate.mjs

# O Chromium recusa rodar como root sem sandbox em algumas configurações, e
# a imagem do Playwright já traz este usuário com as permissões certas.
USER pwuser

EXPOSE 3000
CMD ["node", "server.js"]
